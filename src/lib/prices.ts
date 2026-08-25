import { Decimal, ZERO, dec, parseApiNumber } from './money';
import {
  ASSETS,
  ASSET_IDS,
  assetFromBinanceSymbol,
  assetFromCoinGeckoId,
  type AssetId,
} from './assets';
import type { ConnectionStatus, Quote, Quotes } from './types';
import { loadFxRate, loadQuoteCache, saveFxRate, saveQuoteCache } from './storage';

/**
 * Живи цени.
 *
 *   1. Binance WebSocket combined ticker stream — основен канал.
 *   2. Hyperliquid WebSocket (allMids) — включва се сам за активите, които
 *      Binance не обслужва (на практика HYPE).
 *   3. CoinGecko REST на 30 секунди — когато няма живи потоци, плюс на всеки
 *      10 минути за валутния курс и за 24ч промяната на канал 2.
 *   4. Кеш от последното известно състояние — при офлайн старт.
 */

export interface FeedState {
  quotes: Quotes;
  status: ConnectionStatus;
  lastUpdate: number | null;
  /** Показваме ли последно запазени (офлайн) цени. */
  fromCache: boolean;
  /** Колко EUR струва 1 USD. */
  eurPerUsd: Decimal;
  errorMessage: string | null;
}

type Listener = (state: FeedState) => void;

/**
 * Символът, от който взимаме живия курс евро/долар. CoinGecko го дава веднъж
 * на десет минути; тук идва с всеки тик, затова цените в евро са наистина живи.
 */
export const FX_SYMBOL = 'EURUSDT';

const BINANCE_WS = (assets: AssetId[]): string => {
  const streams = [
    ...assets.map((id) => `${ASSETS[id].binanceSymbol.toLowerCase()}@ticker`),
    `${FX_SYMBOL.toLowerCase()}@ticker`,
  ].join('/');
  return `wss://stream.binance.com:9443/stream?streams=${streams}`;
};

const HYPERLIQUID_WS = 'wss://api.hyperliquid.xyz/ws';
const HYPERLIQUID_SUBSCRIBE = JSON.stringify({
  method: 'subscribe',
  subscription: { type: 'allMids' },
});

const COINGECKO_SIMPLE_PRICE =
  'https://api.coingecko.com/api/v3/simple/price' +
  `?ids=${ASSET_IDS.map((id) => ASSETS[id].coinGeckoId).join(',')}` +
  '&vs_currencies=usd,eur&include_24hr_change=true';

/** Колко време една живa котировка се смята за прясна. */
const LIVE_FRESHNESS_MS = 60_000;
const ANY_FRESHNESS_MS = 120_000;

/** След толкова без тик от Binance пускаме резервния канал. */
const FALLBACK_AFTER_MS = 12_000;

const POLL_INTERVAL_MS = 30_000;
/** На всеки 20 цикъла (10 мин) дърпаме REST и когато всичко е живо. */
const AUXILIARY_EVERY = 20;

const MIN_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

/**
 * Курс EUR за 1 USD, използван само докато не дойде истинският от CoinGecko.
 * Веднъж получен, той се кешира и този резервен вече не се пипа.
 */
export const FALLBACK_EUR_PER_USD = '0.86';

export class PriceFeed {
  private quotes: Quotes = {};
  private status: ConnectionStatus = 'offline';
  private lastUpdate: number | null = null;
  private fromCache = false;
  /**
   * Резервен курс само за първото пускане без интернет. При първата успешна
   * заявка се заменя с истинския и се запазва — оттам нататък този ред няма
   * значение.
   */
  private eurPerUsd: Decimal = dec(FALLBACK_EUR_PER_USD);
  private errorMessage: string | null = null;

  private listeners = new Set<Listener>();

  private binanceSocket: WebSocket | null = null;
  private hyperliquidSocket: WebSocket | null = null;
  private binanceBackoff = MIN_BACKOFF_MS;
  private hyperliquidBackoff = MIN_BACKOFF_MS;
  private binanceRetryTimer: number | null = null;
  private hyperliquidRetryTimer: number | null = null;

  private pollTimer: number | null = null;
  private watchdogTimer: number | null = null;
  private pollTick = 0;

  /** Активите, за които Binance реално е доставил тик. */
  private binanceCovered = new Set<AssetId>();
  /**
   * Кога за последно е дошъл жив курс евро/долар. Докато е пресен, REST
   * заявките не го пипат — техният е стар до десет минути.
   */
  private fxUpdatedAt = 0;
  private startedAt = 0;
  private running = false;

  // -------------------------------------------------------------------------
  // Абонамент
  // -------------------------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  snapshot(): FeedState {
    return {
      quotes: { ...this.quotes },
      status: this.status,
      lastUpdate: this.lastUpdate,
      fromCache: this.fromCache,
      eurPerUsd: this.eurPerUsd,
      errorMessage: this.errorMessage,
    };
  }

  private emit(): void {
    const state = this.snapshot();
    for (const listener of this.listeners) listener(state);
  }

  // -------------------------------------------------------------------------
  // Жизнен цикъл
  // -------------------------------------------------------------------------

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.startedAt = Date.now();

    await this.restoreCache();
    this.connectBinance();
    this.startWatchdog();
    this.startPolling();
    void this.refreshFromRest();
  }

  stop(): void {
    this.running = false;

    this.closeSocket('binance');
    this.closeSocket('hyperliquid');

    if (this.pollTimer !== null) window.clearInterval(this.pollTimer);
    if (this.watchdogTimer !== null) window.clearInterval(this.watchdogTimer);
    this.pollTimer = null;
    this.watchdogTimer = null;

    this.binanceCovered.clear();
    this.recomputeStatus();
  }

  /** Форсиран REST update — pull-to-refresh. */
  async refreshNow(): Promise<void> {
    await this.refreshFromRest(true);
  }

  // -------------------------------------------------------------------------
  // Кеш
  // -------------------------------------------------------------------------

  private async restoreCache(): Promise<void> {
    const [cached, fx] = await Promise.all([loadQuoteCache(), loadFxRate()]);
    if (fx) this.eurPerUsd = fx;

    if (cached.length > 0) {
      for (const entry of cached) {
        this.quotes[entry.asset] = {
          asset: entry.asset,
          price: dec(entry.price),
          change24hPercent: dec(entry.change24hPercent),
          source: 'cache',
          timestamp: entry.timestamp,
        };
      }
      this.lastUpdate = Math.max(...cached.map((entry) => entry.timestamp));
      this.fromCache = true;
    }

    this.recomputeStatus();
    this.emit();
  }

  private persistCache(): void {
    const entries = Object.values(this.quotes)
      .filter((quote): quote is Quote => quote !== undefined)
      .map((quote) => ({
        asset: quote.asset,
        price: quote.price.toFixed(),
        change24hPercent: quote.change24hPercent.toFixed(),
        timestamp: quote.timestamp,
      }));

    if (entries.length > 0) void saveQuoteCache(entries);
  }

  // -------------------------------------------------------------------------
  // Binance
  // -------------------------------------------------------------------------

  private connectBinance(): void {
    if (!this.running) return;

    const socket = new WebSocket(BINANCE_WS(ASSET_IDS));
    this.binanceSocket = socket;

    socket.onopen = () => {
      this.binanceBackoff = MIN_BACKOFF_MS;
      this.errorMessage = null;
    };

    socket.onmessage = (event) => {
      const fx = parseFxTicker(event.data);
      if (fx) {
        this.applyFxRate(fx);
        return;
      }

      const quote = parseBinanceTicker(event.data);
      if (!quote) return;
      this.binanceCovered.add(quote.asset);
      this.apply(quote);
    };

    socket.onerror = () => {
      this.errorMessage = 'Прекъсната връзка с Binance.';
    };

    socket.onclose = () => {
      this.binanceSocket = null;
      this.recomputeStatus();
      this.emit();
      this.scheduleReconnect('binance');
    };
  }

  // -------------------------------------------------------------------------
  // Hyperliquid — резервен канал за отделни активи
  // -------------------------------------------------------------------------

  private connectHyperliquidIfNeeded(): void {
    if (!this.running || this.hyperliquidSocket) return;

    const missing = ASSET_IDS.filter(
      (id) => ASSETS[id].hyperliquidCoin !== null && !this.binanceCovered.has(id),
    );
    if (missing.length === 0) return;

    const socket = new WebSocket(HYPERLIQUID_WS);
    this.hyperliquidSocket = socket;

    socket.onopen = () => {
      this.hyperliquidBackoff = MIN_BACKOFF_MS;
      socket.send(HYPERLIQUID_SUBSCRIBE);
    };

    socket.onmessage = (event) => {
      const mids = parseHyperliquidMids(event.data);
      for (const [asset, price] of mids) {
        // Binance има предимство, ако междувременно е проработил.
        if (this.binanceCovered.has(asset)) continue;
        this.apply({
          asset,
          price,
          // 24ч промяната не идва по allMids — пазим последната известна.
          change24hPercent: this.quotes[asset]?.change24hPercent ?? ZERO,
          source: 'hyperliquid',
          timestamp: Date.now(),
        });
      }
    };

    socket.onclose = () => {
      this.hyperliquidSocket = null;
      this.recomputeStatus();
      this.emit();
      this.scheduleReconnect('hyperliquid');
    };
  }

  // -------------------------------------------------------------------------
  // Reconnect с exponential backoff 1s → 30s
  // -------------------------------------------------------------------------

  private scheduleReconnect(which: 'binance' | 'hyperliquid'): void {
    if (!this.running) return;

    if (which === 'binance') {
      if (this.binanceRetryTimer !== null) return;
      const delay = this.binanceBackoff;
      this.binanceBackoff = Math.min(delay * 2, MAX_BACKOFF_MS);
      this.binanceRetryTimer = window.setTimeout(() => {
        this.binanceRetryTimer = null;
        this.connectBinance();
      }, delay);
    } else {
      if (this.hyperliquidRetryTimer !== null) return;
      const delay = this.hyperliquidBackoff;
      this.hyperliquidBackoff = Math.min(delay * 2, MAX_BACKOFF_MS);
      this.hyperliquidRetryTimer = window.setTimeout(() => {
        this.hyperliquidRetryTimer = null;
        this.connectHyperliquidIfNeeded();
      }, delay);
    }
  }

  private closeSocket(which: 'binance' | 'hyperliquid'): void {
    const socket = which === 'binance' ? this.binanceSocket : this.hyperliquidSocket;
    const timer = which === 'binance' ? this.binanceRetryTimer : this.hyperliquidRetryTimer;

    if (timer !== null) window.clearTimeout(timer);
    if (which === 'binance') this.binanceRetryTimer = null;
    else this.hyperliquidRetryTimer = null;

    if (socket) {
      socket.onclose = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.close();
    }

    if (which === 'binance') this.binanceSocket = null;
    else this.hyperliquidSocket = null;
  }

  // -------------------------------------------------------------------------
  // REST
  // -------------------------------------------------------------------------

  private startPolling(): void {
    this.pollTimer = window.setInterval(() => {
      this.pollTick += 1;
      const needsPrices = this.status !== 'live';
      const needsAuxiliary = this.pollTick % AUXILIARY_EVERY === 0;
      if (needsPrices || needsAuxiliary) void this.refreshFromRest();
    }, POLL_INTERVAL_MS);
  }

  private async refreshFromRest(force = false): Promise<void> {
    try {
      const result = await fetchCoinGecko();

      // Живият курс от Binance е по-пресен от този на CoinGecko; пипаме го
      // само ако потокът мълчи.
      const fxIsStale = Date.now() - this.fxUpdatedAt > LIVE_FRESHNESS_MS;
      if (fxIsStale && result.eurPerUsd && result.eurPerUsd.gt(0)) {
        this.eurPerUsd = result.eurPerUsd;
        void saveFxRate(result.eurPerUsd);
      }
      this.applyRest(result.quotes, force);
      this.errorMessage = null;
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'Неуспешна заявка към CoinGecko.';
      this.recomputeStatus();
      this.emit();
    }
  }

  /** Слива REST котировките, без да гази по-пресни живи данни. */
  private applyRest(incoming: Quotes, force: boolean): void {
    const now = Date.now();

    for (const asset of ASSET_IDS) {
      const restQuote = incoming[asset];
      if (!restQuote) continue;

      const existing = this.quotes[asset];
      if (!existing) {
        this.quotes[asset] = restQuote;
        continue;
      }

      const isFreshLive =
        (existing.source === 'binance' || existing.source === 'hyperliquid') &&
        now - existing.timestamp < LIVE_FRESHNESS_MS;

      if (isFreshLive && !force) {
        if (existing.source === 'hyperliquid') {
          // Hyperliquid не дава 24ч промяна — допълваме я от REST,
          // но пазим по-пресната жива цена.
          this.quotes[asset] = {
            ...existing,
            change24hPercent: restQuote.change24hPercent,
          };
        }
      } else {
        this.quotes[asset] = restQuote;
      }
    }

    this.fromCache = false;
    this.lastUpdate = now;
    this.persistCache();
    this.recomputeStatus();
    this.emit();
  }

  // -------------------------------------------------------------------------
  // Общо прилагане
  // -------------------------------------------------------------------------

  /**
   * Живият курс от Binance. `EURUSDT` показва колко долара струва едно евро,
   * а нам ни трябва обратното — колко евро струва един долар.
   */
  private applyFxRate(eurUsdt: Decimal): void {
    if (eurUsdt.lte(0)) return;

    const eurPerUsd = dec(1).div(eurUsdt);
    this.fxUpdatedAt = Date.now();

    // Пресмятанията текат при всеки тик; записваме само при осезаема промяна,
    // за да не хабим IndexedDB на всяка стотна от процента.
    const changed = this.eurPerUsd.isZero()
      ? true
      : eurPerUsd.minus(this.eurPerUsd).abs().div(this.eurPerUsd).gt(dec('0.0001'));

    this.eurPerUsd = eurPerUsd;
    if (changed) void saveFxRate(eurPerUsd);

    this.emit();
  }

  private apply(quote: Quote): void {
    const previous = this.quotes[quote.asset];

    // Пазим последната известна 24ч промяна, ако новият източник не я дава.
    const change24hPercent =
      quote.change24hPercent.isZero() && previous && !previous.change24hPercent.isZero()
        ? previous.change24hPercent
        : quote.change24hPercent;

    this.quotes[quote.asset] = { ...quote, change24hPercent };
    this.fromCache = false;
    this.lastUpdate = quote.timestamp;

    this.recomputeStatus();
    this.persistCache();
    this.emit();
  }

  // -------------------------------------------------------------------------
  // Статус
  // -------------------------------------------------------------------------

  private startWatchdog(): void {
    this.watchdogTimer = window.setInterval(() => {
      this.recomputeStatus();
      this.emit();

      if (Date.now() - this.startedAt > FALLBACK_AFTER_MS) {
        this.connectHyperliquidIfNeeded();
      }
    }, 3_000);
  }

  private recomputeStatus(): void {
    const now = Date.now();

    const live = ASSET_IDS.filter((asset) => {
      const quote = this.quotes[asset];
      return (
        quote !== undefined &&
        (quote.source === 'binance' || quote.source === 'hyperliquid') &&
        now - quote.timestamp < LIVE_FRESHNESS_MS
      );
    });

    const recent = ASSET_IDS.filter((asset) => {
      const quote = this.quotes[asset];
      return (
        quote !== undefined &&
        quote.source !== 'cache' &&
        now - quote.timestamp < ANY_FRESHNESS_MS
      );
    });

    this.status =
      live.length === ASSET_IDS.length ? 'live' : recent.length > 0 ? 'degraded' : 'offline';
  }
}

// ---------------------------------------------------------------------------
// Парсване
// ---------------------------------------------------------------------------

/** Binance combined stream: { stream, data: { s, c, P } } */
export function parseBinanceTicker(raw: unknown): Quote | null {
  if (typeof raw !== 'string') return null;

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return null;
  }

  const envelope = payload as { data?: unknown };
  const ticker = (envelope.data ?? payload) as {
    s?: string;
    c?: string;
    P?: string;
  };

  if (typeof ticker.s !== 'string' || typeof ticker.c !== 'string') return null;

  const asset = assetFromBinanceSymbol(ticker.s);
  if (!asset) return null;

  const price = parseApiNumber(ticker.c);
  if (!price || price.lte(0)) return null;

  return {
    asset,
    price,
    change24hPercent: parseApiNumber(ticker.P) ?? ZERO,
    source: 'binance',
    timestamp: Date.now(),
  };
}

/**
 * Курсът евро/долар от същия поток. Връща колко долара струва едно евро,
 * или null, ако съобщението е за нещо друго.
 */
export function parseFxTicker(raw: unknown): Decimal | null {
  if (typeof raw !== 'string') return null;
  // Бърза проверка, преди да плащаме за JSON.parse на всеки тик.
  if (!raw.includes(FX_SYMBOL)) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return null;
  }

  const envelope = payload as { data?: unknown };
  const ticker = (envelope.data ?? payload) as { s?: string; c?: string };

  if (ticker.s !== FX_SYMBOL) return null;

  const price = parseApiNumber(ticker.c);
  return price && price.gt(0) ? price : null;
}

/** Hyperliquid: { channel: 'allMids', data: { mids: { HYPE: '12.34' } } } */
export function parseHyperliquidMids(raw: unknown): Array<[AssetId, Decimal]> {
  if (typeof raw !== 'string') return [];

  let payload: { channel?: string; data?: { mids?: Record<string, string> } };
  try {
    payload = JSON.parse(raw);
  } catch {
    return [];
  }

  if (payload.channel !== 'allMids' || !payload.data?.mids) return [];

  const result: Array<[AssetId, Decimal]> = [];
  for (const asset of ASSET_IDS) {
    const coin = ASSETS[asset].hyperliquidCoin;
    if (!coin) continue;

    const price = parseApiNumber(payload.data.mids[coin]);
    if (price && price.gt(0)) result.push([asset, price]);
  }
  return result;
}

interface CoinGeckoResult {
  quotes: Quotes;
  eurPerUsd: Decimal | null;
}

/** REST fallback. 429 се обработва с изчакване и повторен опит. */
export async function fetchCoinGecko(attempt = 1): Promise<CoinGeckoResult> {
  const response = await fetch(COINGECKO_SIMPLE_PRICE, {
    headers: { Accept: 'application/json' },
  });

  if (response.status === 429 || response.status >= 500) {
    if (attempt >= 3) throw new Error('Твърде много заявки. Опитай пак след минута.');

    const retryAfter = Number(response.headers.get('Retry-After'));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : Math.min(MIN_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);

    await new Promise((resolve) => window.setTimeout(resolve, waitMs));
    return fetchCoinGecko(attempt + 1);
  }

  if (!response.ok) throw new Error(`Сървърът върна грешка ${response.status}.`);

  const payload = (await response.json()) as Record<string, Record<string, number>>;

  const quotes: Quotes = {};
  const fxSamples: Decimal[] = [];
  const now = Date.now();

  for (const [id, values] of Object.entries(payload)) {
    const asset = assetFromCoinGeckoId(id);
    if (!asset) continue;

    const usd = parseApiNumber(values.usd);
    if (!usd || usd.lte(0)) continue;

    quotes[asset] = {
      asset,
      price: usd,
      change24hPercent: parseApiNumber(values.usd_24h_change) ?? ZERO,
      source: 'coingecko',
      timestamp: now,
    };

    const eur = parseApiNumber(values.eur);
    if (eur && eur.gt(0)) fxSamples.push(eur.div(usd));
  }

  if (Object.keys(quotes).length === 0) throw new Error('Няма данни от CoinGecko.');

  // Средно от наличните проби — по-устойчиво от една монета.
  const eurPerUsd =
    fxSamples.length > 0
      ? fxSamples.reduce((sum, value) => sum.plus(value), ZERO).div(fxSamples.length)
      : null;

  return { quotes, eurPerUsd };
}
