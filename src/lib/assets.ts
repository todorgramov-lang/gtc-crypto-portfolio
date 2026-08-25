/**
 * Всички поддържани активи. За да добавиш нов, допиши един запис тук —
 * останалата част от приложението се адаптира сама.
 */

export type AssetId = 'BTC' | 'ETH' | 'SOL' | 'HYPE' | 'XAU';

/** Криптовалути и благородни метали се сумират отделно. */
export type AssetGroup = 'crypto' | 'metal';

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
  /**
   * Към коя група спада. Групите се сумират поотделно — златото не влиза
   * в общата стойност на криптото.
   */
  group: AssetGroup;
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
    group: 'crypto',
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
    group: 'crypto',
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
    group: 'crypto',
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
    group: 'crypto',
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
    group: 'metal',
    note: 'по PAX Gold',
  },
};

/** Редът, в който активите се показват навсякъде. */
export const ASSET_IDS: AssetId[] = ['BTC', 'ETH', 'SOL', 'HYPE', 'XAU'];

export const assetInfo = (id: AssetId): AssetInfo => ASSETS[id];

export const assetGroup = (id: AssetId): AssetGroup => ASSETS[id].group;

/** Имената на групите, както се показват.  */
export const GROUP_LABEL: Record<AssetGroup, string> = {
  crypto: 'Крипто',
  metal: 'Злато',
};

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
