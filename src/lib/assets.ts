/**
 * Всички поддържани активи. За да добавиш нов, допиши един запис тук —
 * останалата част от приложението се адаптира сама.
 */

export type AssetId = 'BTC' | 'ETH' | 'SOL' | 'HYPE' | 'XAU';

export interface AssetInfo {
  id: AssetId;
  name: string;
  /** Символ в Binance spot (срещу USDT). */
  binanceSymbol: string;
  /** Идентификатор в CoinGecko. */
  coinGeckoId: string;
  /** Име на монетата в Hyperliquid (ключ в allMids); null = не се обслужва. */
  hyperliquidCoin: string | null;
  /** Знаци след десетичната точка при показване на цена. */
  priceDecimals: number;
  /** Акцентен цвят. */
  tint: string;
  /** Знакът в кръгчето на картата. */
  glyph: string;
  /**
   * Мярката, в която се води количеството. За криптовалутите това е самата
   * монета; за златото — тройунция, защото цената идва в долари за унция.
   */
  canonicalUnit: string;
  /** Пояснение под името, когато има какво да се каже за източника. */
  note?: string;
}

export const ASSETS: Record<AssetId, AssetInfo> = {
  BTC: {
    id: 'BTC',
    name: 'Bitcoin',
    binanceSymbol: 'BTCUSDT',
    coinGeckoId: 'bitcoin',
    hyperliquidCoin: null,
    priceDecimals: 2,
    tint: '#F7931A',
    glyph: 'B',
    canonicalUnit: 'BTC',
  },
  ETH: {
    id: 'ETH',
    name: 'Ethereum',
    binanceSymbol: 'ETHUSDT',
    coinGeckoId: 'ethereum',
    hyperliquidCoin: null,
    priceDecimals: 2,
    tint: '#8A92B2',
    glyph: 'E',
    canonicalUnit: 'ETH',
  },
  SOL: {
    id: 'SOL',
    name: 'Solana',
    binanceSymbol: 'SOLUSDT',
    coinGeckoId: 'solana',
    hyperliquidCoin: null,
    priceDecimals: 2,
    tint: '#14F195',
    glyph: 'S',
    canonicalUnit: 'SOL',
  },
  HYPE: {
    id: 'HYPE',
    name: 'Hyperliquid',
    binanceSymbol: 'HYPEUSDT',
    coinGeckoId: 'hyperliquid',
    hyperliquidCoin: 'HYPE',
    priceDecimals: 3,
    tint: '#4FE9CD',
    glyph: 'H',
    canonicalUnit: 'HYPE',
  },
  XAU: {
    id: 'XAU',
    name: 'Злато',
    /**
     * Няма безплатен източник за лондонския спот фиксинг на златото, затова
     * цената идва от PAX Gold — токен, обезпечен едно към едно с физическо
     * злато в трезор, където една единица е една тройунция. Разминава се със
     * спота с части от процента.
     */
    binanceSymbol: 'PAXGUSDT',
    coinGeckoId: 'pax-gold',
    hyperliquidCoin: null,
    priceDecimals: 2,
    tint: '#D4AF37',
    glyph: 'Au',
    canonicalUnit: 'oz',
    note: 'по PAX Gold',
  },
};

/** Редът, в който активите се показват навсякъде. */
export const ASSET_IDS: AssetId[] = ['BTC', 'ETH', 'SOL', 'HYPE', 'XAU'];

export const assetInfo = (id: AssetId): AssetInfo => ASSETS[id];

/** Количествата се показват с най-много толкова знака. */
export const QUANTITY_DECIMALS = 8;

export function assetFromBinanceSymbol(symbol: string): AssetId | null {
  const upper = symbol.toUpperCase();
  return ASSET_IDS.find((id) => ASSETS[id].binanceSymbol === upper) ?? null;
}

export function assetFromCoinGeckoId(id: string): AssetId | null {
  return ASSET_IDS.find((asset) => ASSETS[asset].coinGeckoId === id) ?? null;
}

export function isAssetId(value: string): value is AssetId {
  return (ASSET_IDS as string[]).includes(value.toUpperCase());
}
