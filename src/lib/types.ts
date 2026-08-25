import type { Decimal } from './money';
import type { AssetId } from './assets';
import type { PortfolioSelection } from './portfolios';
import type { ThemeId } from './themes';
import type { GoldUnit } from './units';

export type TxType = 'buy' | 'sell' | 'transferIn' | 'transferOut';

/** Увеличава ли наличността. */
export const isInflow = (type: TxType): boolean => type === 'buy' || type === 'transferIn';

/** Намалява ли наличността. */
export const isOutflow = (type: TxType): boolean => type === 'sell' || type === 'transferOut';

/**
 * Транзакция, както се съхранява. Паричните полета са низове, за да не минават
 * през float при запис в IndexedDB. Цената и таксата са в USD.
 */
export interface StoredTransaction {
  id: string;
  asset: AssetId;
  type: TxType;
  quantity: string;
  pricePerUnit: string;
  fee: string;
  /** ISO 8601. */
  date: string;
  exchange: string;
  note: string | null;
  /** На кое портфолио принадлежи (Анна, Тодор…). */
  portfolioId: string;
}

/** Транзакция, готова за смятане. */
export interface Transaction {
  id: string;
  asset: AssetId;
  type: TxType;
  quantity: Decimal;
  pricePerUnit: Decimal;
  fee: Decimal;
  date: Date;
  exchange: string;
  note: string | null;
  portfolioId: string;
}

/** Изчислима позиция по един актив — не се съхранява. Всички суми в USD. */
export interface Holding {
  asset: AssetId;
  quantity: Decimal;
  averageCost: Decimal;
  invested: Decimal;
  realizedProfitLoss: Decimal;
  currentPrice: Decimal;
  change24hPercent: Decimal;
  hasActivity: boolean;

  currentValue: Decimal;
  unrealizedProfitLoss: Decimal;
  unrealizedProfitLossPercent: Decimal;
  value24hAgo: Decimal;
  change24hValue: Decimal;
}

/** Сумите на една група активи. Всичко в USD. */
export interface Totals {
  value: Decimal;
  invested: Decimal;
  profitLoss: Decimal;
  profitLossPercent: Decimal;
  realizedProfitLoss: Decimal;
  change24hValue: Decimal;
  change24hPercent: Decimal;
  /** Има ли изобщо движения в тази група. */
  hasActivity: boolean;
}

export interface PortfolioSummary {
  holdings: Holding[];
  /** Криптовалутите — това е голямото число най-горе. */
  crypto: Totals;
  /** Златото — стои отделно, за да не се смесва с криптото. */
  metal: Totals;
  /** Двете заедно; ползва се само където изрично трябва общо. */
  combined: Totals;
  /** Дял на всеки крипто актив в проценти, в рамките на криптото. */
  allocation: Record<AssetId, Decimal>;
  hasAnyActivity: boolean;
}

export type PriceSource = 'binance' | 'hyperliquid' | 'coingecko' | 'cache';

export interface Quote {
  asset: AssetId;
  price: Decimal;
  change24hPercent: Decimal;
  source: PriceSource;
  timestamp: number;
}

export type Quotes = Partial<Record<AssetId, Quote>>;

/** Зелена / жълта / червена точка. */
export type ConnectionStatus = 'live' | 'degraded' | 'offline';

export type CostBasisMethod = 'average' | 'fifo';
export type DisplayCurrency = 'EUR' | 'USD';

export interface Settings {
  currency: DisplayCurrency;
  costBasis: CostBasisMethod;
  privacyMode: boolean;
  /** Пулсиране на цените при промяна. */
  priceFlash: boolean;
  /** Цветова тема на приложението. */
  theme: ThemeId;
  /** Кое портфолио се гледа в момента (или всички заедно). */
  selection: PortfolioSelection;
  /** В какво се мери златото при показване и въвеждане. */
  goldUnit: GoldUnit;
  /** Показва само една борса; null означава всички. */
  exchangeFilter: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  currency: 'EUR',
  costBasis: 'average',
  privacyMode: false,
  priceFlash: true,
  theme: 'midnight',
  selection: 'all',
  goldUnit: 'oz',
  exchangeFilter: null,
};

export type ChartRange = '24h' | '7d' | '30d' | '1y';

export interface PricePoint {
  time: number;
  close: number;
}

export interface PriceAlert {
  id: string;
  asset: AssetId;
  direction: 'above' | 'below';
  /** Праг в USD. */
  target: string;
  enabled: boolean;
  lastTriggeredAt: number | null;
}
