import { ASSETS, type AssetId } from './assets';
import type { ChartRange, PricePoint } from './types';

/**
 * Исторически данни за графиките.
 * Приоритет: Binance klines → CoinGecko market_chart (напр. за HYPE).
 */

interface RangeConfig {
  /** Binance интервал на свещите. */
  interval: string;
  /** Брой свещи, така че да покрием диапазона. */
  limit: number;
  /** Дни назад — за CoinGecko. */
  days: number;
  /** Колко време кешът се смята за пресен. */
  maxAgeMs: number;
}

export const RANGE_CONFIG: Record<ChartRange, RangeConfig> = {
  '24h': { interval: '15m', limit: 96, days: 1, maxAgeMs: 60_000 },
  '7d': { interval: '1h', limit: 168, days: 7, maxAgeMs: 300_000 },
  '30d': { interval: '4h', limit: 180, days: 30, maxAgeMs: 900_000 },
  '1y': { interval: '1d', limit: 365, days: 365, maxAgeMs: 3_600_000 },
};

export const RANGE_LABELS: Record<ChartRange, string> = {
  '24h': '24ч',
  '7d': '7д',
  '30d': '30д',
  '1y': '1г',
};

export const CHART_RANGES: ChartRange[] = ['24h', '7d', '30d', '1y'];

interface CacheEntry {
  points: PricePoint[];
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

/** Активите, за които вече знаем, че Binance не ги поддържа. */
const binanceUnavailable = new Set<AssetId>();

async function fetchBinanceKlines(
  asset: AssetId,
  range: ChartRange,
): Promise<PricePoint[]> {
  const config = RANGE_CONFIG[range];
  const url =
    'https://api.binance.com/api/v3/klines' +
    `?symbol=${ASSETS[asset].binanceSymbol}` +
    `&interval=${config.interval}` +
    `&limit=${config.limit}`;

  const response = await fetch(url, { headers: { Accept: 'application/json' } });

  // Непознат символ — Binance връща 400. Запомняме, за да не питаме пак.
  if (response.status === 400 || response.status === 404) {
    binanceUnavailable.add(asset);
    throw new Error('symbol-unavailable');
  }
  if (!response.ok) throw new Error(`Binance върна ${response.status}`);

  const rows = (await response.json()) as unknown[];
  if (!Array.isArray(rows)) throw new Error('Неразпознат отговор от Binance.');

  // Всяка свещ: [openTime, open, high, low, close, ...]
  return rows
    .map((row) => {
      if (!Array.isArray(row) || row.length < 5) return null;
      const time = Number(row[0]);
      const close = Number(row[4]);
      if (!Number.isFinite(time) || !Number.isFinite(close)) return null;
      return { time, close };
    })
    .filter((point): point is PricePoint => point !== null);
}

async function fetchCoinGeckoChart(
  asset: AssetId,
  range: ChartRange,
): Promise<PricePoint[]> {
  const config = RANGE_CONFIG[range];
  const url =
    `https://api.coingecko.com/api/v3/coins/${ASSETS[asset].coinGeckoId}/market_chart` +
    `?vs_currency=usd&days=${config.days}`;

  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`CoinGecko върна ${response.status}`);

  const payload = (await response.json()) as { prices?: Array<[number, number]> };
  const prices = payload.prices ?? [];

  return prices
    .filter((pair) => Array.isArray(pair) && pair.length >= 2)
    .map(([time, close]) => ({ time, close }));
}

export async function loadChart(
  asset: AssetId,
  range: ChartRange,
  forceRefresh = false,
): Promise<PricePoint[]> {
  const key = `${asset}:${range}`;
  const cached = cache.get(key);

  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < RANGE_CONFIG[range].maxAgeMs) {
    return cached.points;
  }

  let points: PricePoint[] = [];

  if (!binanceUnavailable.has(asset)) {
    try {
      points = await fetchBinanceKlines(asset, range);
    } catch {
      // Мрежова грешка или непознат символ — пробваме резервния източник.
    }
  }

  if (points.length === 0) {
    points = await fetchCoinGeckoChart(asset, range);
  }

  if (points.length === 0) throw new Error('Няма данни за графиката.');

  cache.set(key, { points, fetchedAt: Date.now() });
  return points;
}
