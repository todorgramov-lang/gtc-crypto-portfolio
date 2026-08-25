import { Decimal, dec } from './money';
import type { DisplayCurrency, Quote, Quotes, Transaction } from './types';

/**
 * Превръщане между валути на границата на изчисленията.
 *
 * Всяка сделка помни в каква валута е сключена. Изчисленията работят изцяло
 * в показваната валута: сделка, сключена в нея, влиза непокътната — точно
 * толкова, колкото си платил, завинаги. Само сделка в друга валута минава
 * през курса, и то по днешния, защото историческият не се пази.
 *
 * Точно това е причината да не превръщаме при въвеждане: ако запишехме
 * еврова покупка в долари, утрешното връщане обратно в евро щеше да дава
 * различно число всеки ден.
 */

/** Колко струва една единица от `from`, изразена в `to`. */
export function rateBetween(
  from: DisplayCurrency,
  to: DisplayCurrency,
  eurPerUsd: Decimal,
): Decimal {
  if (from === to) return dec(1);
  // 1 USD = eurPerUsd EUR; обратното е реципрочното.
  return from === 'USD' ? eurPerUsd : dec(1).div(eurPerUsd);
}

export function convertAmount(
  amount: Decimal,
  from: DisplayCurrency,
  to: DisplayCurrency,
  eurPerUsd: Decimal,
): Decimal {
  if (from === to) return amount;
  return amount.times(rateBetween(from, to, eurPerUsd));
}

/**
 * Привежда сделката към показваната валута. Количеството не се пипа —
 * то не е пари.
 */
export function convertTransaction(
  tx: Transaction,
  to: DisplayCurrency,
  eurPerUsd: Decimal,
): Transaction {
  if (tx.currency === to) return tx;

  const rate = rateBetween(tx.currency, to, eurPerUsd);
  return {
    ...tx,
    pricePerUnit: tx.pricePerUnit.times(rate),
    fee: tx.fee.times(rate),
    currency: to,
  };
}

/** Пазарните цени идват в долари; привеждаме ги към показваната валута. */
export function convertQuote(
  quote: Quote,
  to: DisplayCurrency,
  eurPerUsd: Decimal,
): Quote {
  if (to === 'USD') return quote;
  return { ...quote, price: quote.price.times(eurPerUsd) };
}

export function convertQuotes(
  quotes: Quotes,
  to: DisplayCurrency,
  eurPerUsd: Decimal,
): Quotes {
  if (to === 'USD') return quotes;

  const out: Quotes = {};
  for (const [asset, quote] of Object.entries(quotes)) {
    if (quote) out[asset as keyof Quotes] = convertQuote(quote, to, eurPerUsd);
  }
  return out;
}
