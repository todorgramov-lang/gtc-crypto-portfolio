import { Decimal, ZERO } from './money';
import { assetInfo, QUANTITY_DECIMALS, type AssetId } from './assets';
import {
  quantityDecimals,
  toDisplayPrice,
  toDisplayQuantity,
  unitLabel,
  type GoldUnit,
} from './units';
import type { DisplayCurrency } from './types';

/** Маска за privacy режим. */
export const MASKED = '●●●●';

const CURRENCY_SYMBOL: Record<DisplayCurrency, string> = {
  EUR: '€',
  USD: '$',
};

/** Тесен интервал за разделител на хиляди — не подскача при моноспейс. */
const GROUP_SEPARATOR = ' ';

/** Групира целите числа по три: 1234567.89 → 1 234 567.89 */
function group(text: string): string {
  const negative = text.startsWith('-');
  const body = negative ? text.slice(1) : text;
  const [whole = '0', fraction] = body.split('.');

  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEPARATOR);
  const result = fraction ? `${grouped}.${fraction}` : grouped;

  return negative ? `-${result}` : result;
}

/** Парична сума с валутен знак. */
export function money(
  value: Decimal,
  currency: DisplayCurrency,
  decimals = 2,
): string {
  const symbol = CURRENCY_SYMBOL[currency];
  const negative = value.isNegative();
  const body = group(value.abs().toFixed(decimals));
  return `${negative ? '−' : ''}${symbol}${body}`;
}

/** Сума със знак отпред — за печалба/загуба. */
export function signedMoney(
  value: Decimal,
  currency: DisplayCurrency,
  decimals = 2,
): string {
  const symbol = CURRENCY_SYMBOL[currency];
  const body = group(value.abs().toFixed(decimals));

  if (value.gt(0)) return `+${symbol}${body}`;
  if (value.lt(0)) return `−${symbol}${body}`;
  return `${symbol}${body}`;
}

/** Цена на актив — 2 знака за BTC/ETH/SOL, 3 за HYPE. */
export function price(
  value: Decimal,
  asset: AssetId,
  currency: DisplayCurrency,
): string {
  return money(value, currency, assetInfo(asset).priceDecimals);
}

/** Процент със знак. */
export function signedPercent(value: Decimal, decimals = 2): string {
  const body = value.abs().toFixed(decimals);
  if (value.gt(0)) return `+${body}%`;
  if (value.lt(0)) return `−${body}%`;
  return `${body}%`;
}

/** Процент без знак — за дялове. */
export function percent(value: Decimal, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/** Количество — до 8 знака, без излишни нули накрая. */
export function quantity(value: Decimal, decimals = QUANTITY_DECIMALS): string {
  const fixed = value.toFixed(decimals);
  const trimmed = fixed.includes('.')
    ? fixed.replace(/0+$/, '').replace(/\.$/, '')
    : fixed;
  return group(trimmed);
}

export function quantityWithSymbol(value: Decimal, asset: AssetId): string {
  return `${quantity(value)} ${asset}`;
}

/** Число за CSV — винаги с точка, без разделители. */
export function csvNumber(value: Decimal): string {
  return value.toFixed();
}

// ---------------------------------------------------------------------------
// Дати
// ---------------------------------------------------------------------------

const dateFormatter = new Intl.DateTimeFormat('bg-BG', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('bg-BG', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const monthFormatter = new Intl.DateTimeFormat('bg-BG', {
  month: 'long',
  year: 'numeric',
});

export const formatDate = (date: Date): string => dateFormatter.format(date);
export const formatTime = (date: Date): string => timeFormatter.format(date);

export function formatMonth(date: Date): string {
  const text = monthFormatter.format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** ISO дата за CSV. */
export const csvDate = (date: Date): string => date.toISOString();

/** Ключ за групиране по месец. */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Форматиране според настройките (валута + privacy режим)
// ---------------------------------------------------------------------------

export interface Formatter {
  /** Парична сума в избраната валута; скрива се в privacy режим. */
  money: (usd: Decimal) => string;
  /** Сума със знак; скрива се в privacy режим. */
  signedMoney: (usd: Decimal) => string;
  /**
   * Цена за една показвана единица — остава видима, защото е публична.
   * За златото това е цената за грам или за унция, според настройката.
   */
  price: (usd: Decimal, asset: AssetId) => string;
  /** Количество в показваната мярка; скрива се в privacy режим. */
  quantity: (value: Decimal, asset: AssetId) => string;
  /** Процентите остават видими — не издават размера на портфолиото. */
  signedPercent: (value: Decimal) => string;
  percent: (value: Decimal) => string;
  currency: DisplayCurrency;
  goldUnit: GoldUnit;
}

export function makeFormatter(
  currency: DisplayCurrency,
  eurPerUsd: Decimal,
  privacyMode: boolean,
  goldUnit: GoldUnit,
): Formatter {
  const convert = (usd: Decimal): Decimal =>
    currency === 'USD' ? usd : usd.times(eurPerUsd);

  return {
    currency,
    goldUnit,
    money: (usd) => (privacyMode ? MASKED : money(convert(usd), currency)),
    signedMoney: (usd) => (privacyMode ? MASKED : signedMoney(convert(usd), currency)),

    price: (usd, asset) =>
      money(
        toDisplayPrice(convert(usd), asset, goldUnit),
        currency,
        assetInfo(asset).priceDecimals,
      ),

    quantity: (value, asset) => {
      const label = unitLabel(asset, goldUnit);
      if (privacyMode) return `${MASKED} ${label}`;

      const shown = toDisplayQuantity(value, asset, goldUnit);
      return `${quantity(shown, quantityDecimals(asset, goldUnit))} ${label}`;
    },

    signedPercent: (value) => signedPercent(value ?? ZERO),
    percent: (value) => percent(value ?? ZERO),
  };
}
