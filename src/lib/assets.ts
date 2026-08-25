/**
 * Всички поддържани активи. За да добавиш нов, допиши един запис тук —
 * останалата част от приложението се адаптира сама.
 */

export type AssetId = 'BTC' | 'ETH' | 'SOL' | 'HYPE';

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
  },
  ETH: {
    id: 'ETH',
    name: 'Ethereum',
    binanceSymbol: 'ETHUSDT',
    coinGeckoId: 'ethereum',
    hyperliquidCoin: null,
    priceDecimals: 2,
    tint: '#8A92B2',
  },
  SOL: {
    id: 'SOL',
    name: 'Solana',
    binanceSymbol: 'SOLUSDT',
    coinGeckoId: 'solana',
    hyperliquidCoin: null,
    priceDecimals: 2,
    tint: '#14F195',
  },
  HYPE: {
    id: 'HYPE',
    name: 'Hyperliquid',
    binanceSymbol: 'HYPEUSDT',
    coinGeckoId: 'hyperliquid',
    hyperliquidCoin: 'HYPE',
    priceDecimals: 3,
    tint: '#4FE9CD',
  },
};

/** Редът, в който активите се показват навсякъде. */
export const ASSET_IDS: AssetId[] = ['BTC', 'ETH', 'SOL', 'HYPE'];

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
