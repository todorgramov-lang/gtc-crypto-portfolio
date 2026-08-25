import { get, set } from 'idb-keyval';
import { dec, toStorage, type Decimal } from './money';
import { isAssetId, type AssetId } from './assets';
import { DEFAULT_PORTFOLIOS, type Portfolio } from './portfolios';
import { DEFAULT_THEME, THEMES, type ThemeId } from './themes';
import {
  DEFAULT_SETTINGS,
  type PriceAlert,
  type Settings,
  type StoredTransaction,
  type Transaction,
  type TxType,
} from './types';

/**
 * Всичко живее в IndexedDB на телефона — както при Корфу. Никакъв сървър,
 * никакъв акаунт, нищо не излиза навън.
 */

const KEY_TRANSACTIONS = 'crypto.transactions';
const KEY_SETTINGS = 'crypto.settings';
const KEY_ALERTS = 'crypto.alerts';
const KEY_PORTFOLIOS = 'crypto.portfolios';
const KEY_QUOTE_CACHE = 'crypto.quoteCache';
const KEY_FX_RATE = 'crypto.fxRate';

const TX_TYPES: TxType[] = ['buy', 'sell', 'transferIn', 'transferOut'];

// ---------------------------------------------------------------------------
// Транзакции
// ---------------------------------------------------------------------------

/** Превръща записа в готов за смятане обект. */
export function hydrate(stored: StoredTransaction): Transaction {
  return {
    id: stored.id,
    asset: stored.asset,
    type: stored.type,
    quantity: dec(stored.quantity),
    pricePerUnit: dec(stored.pricePerUnit),
    fee: dec(stored.fee),
    date: new Date(stored.date),
    exchange: stored.exchange,
    note: stored.note,
    // Записите отпреди въвеждането на портфолиата минават към първото.
    portfolioId: stored.portfolioId || DEFAULT_PORTFOLIOS[0]!.id,
  };
}

export function dehydrate(tx: Transaction): StoredTransaction {
  return {
    id: tx.id,
    asset: tx.asset,
    type: tx.type,
    quantity: toStorage(tx.quantity),
    pricePerUnit: toStorage(tx.pricePerUnit),
    fee: toStorage(tx.fee),
    date: tx.date.toISOString(),
    exchange: tx.exchange,
    note: tx.note,
    portfolioId: tx.portfolioId,
  };
}

/** Пази ни от повреден или ръчно пипан запис. */
function isValidStored(value: unknown): value is StoredTransaction {
  if (typeof value !== 'object' || value === null) return false;
  const tx = value as Record<string, unknown>;

  return (
    typeof tx.id === 'string' &&
    typeof tx.asset === 'string' &&
    isAssetId(tx.asset) &&
    typeof tx.type === 'string' &&
    TX_TYPES.includes(tx.type as TxType) &&
    typeof tx.quantity === 'string' &&
    typeof tx.pricePerUnit === 'string' &&
    typeof tx.fee === 'string' &&
    typeof tx.date === 'string' &&
    !Number.isNaN(Date.parse(tx.date))
  );
}

export async function loadTransactions(): Promise<Transaction[]> {
  const raw = await get<unknown>(KEY_TRANSACTIONS);
  if (!Array.isArray(raw)) return [];

  return raw
    .filter(isValidStored)
    .map((stored) => hydrate(stored as StoredTransaction))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

export async function saveTransactions(transactions: Transaction[]): Promise<void> {
  await set(KEY_TRANSACTIONS, transactions.map(dehydrate));
}

// ---------------------------------------------------------------------------
// Настройки
// ---------------------------------------------------------------------------

export async function loadSettings(): Promise<Settings> {
  const raw = await get<Partial<Settings>>(KEY_SETTINGS);
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };

  const theme = THEMES.some((item) => item.id === raw.theme)
    ? (raw.theme as ThemeId)
    : DEFAULT_THEME;

  return {
    currency: raw.currency === 'USD' ? 'USD' : 'EUR',
    costBasis: raw.costBasis === 'fifo' ? 'fifo' : 'average',
    privacyMode: raw.privacyMode === true,
    priceFlash: raw.priceFlash !== false,
    theme,
    selection: typeof raw.selection === 'string' ? raw.selection : 'all',
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await set(KEY_SETTINGS, settings);
}

// ---------------------------------------------------------------------------
// Портфолиа
// ---------------------------------------------------------------------------

function isValidPortfolio(value: unknown): value is Portfolio {
  if (typeof value !== 'object' || value === null) return false;
  const portfolio = value as Record<string, unknown>;

  return (
    typeof portfolio.id === 'string' &&
    portfolio.id.length > 0 &&
    typeof portfolio.name === 'string' &&
    typeof portfolio.color === 'string'
  );
}

export async function loadPortfolios(): Promise<Portfolio[]> {
  const raw = await get<unknown>(KEY_PORTFOLIOS);
  if (!Array.isArray(raw)) return DEFAULT_PORTFOLIOS.map((item) => ({ ...item }));

  const valid = raw.filter(isValidPortfolio);
  // Никога не оставаме без нито едно портфолио — иначе няма къде да отиде
  // следващата транзакция.
  return valid.length > 0 ? valid : DEFAULT_PORTFOLIOS.map((item) => ({ ...item }));
}

export async function savePortfolios(portfolios: Portfolio[]): Promise<void> {
  await set(KEY_PORTFOLIOS, portfolios);
}

// ---------------------------------------------------------------------------
// Ценови аларми
// ---------------------------------------------------------------------------

export async function loadAlerts(): Promise<PriceAlert[]> {
  const raw = await get<PriceAlert[]>(KEY_ALERTS);
  return Array.isArray(raw) ? raw : [];
}

export async function saveAlerts(alerts: PriceAlert[]): Promise<void> {
  await set(KEY_ALERTS, alerts);
}

// ---------------------------------------------------------------------------
// Кеш на последните цени — за офлайн старт
// ---------------------------------------------------------------------------

export interface CachedQuote {
  asset: AssetId;
  price: string;
  change24hPercent: string;
  timestamp: number;
}

export async function loadQuoteCache(): Promise<CachedQuote[]> {
  const raw = await get<CachedQuote[]>(KEY_QUOTE_CACHE);
  return Array.isArray(raw) ? raw : [];
}

export async function saveQuoteCache(quotes: CachedQuote[]): Promise<void> {
  await set(KEY_QUOTE_CACHE, quotes);
}

export async function loadFxRate(): Promise<Decimal | null> {
  const raw = await get<string>(KEY_FX_RATE);
  if (typeof raw !== 'string') return null;
  const value = dec(raw);
  return value.gt(0) ? value : null;
}

export async function saveFxRate(rate: Decimal): Promise<void> {
  await set(KEY_FX_RATE, toStorage(rate));
}

/** Уникален идентификатор без външна зависимост. */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
