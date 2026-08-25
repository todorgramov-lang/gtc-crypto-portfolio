import Decimal from 'decimal.js';

/**
 * В JavaScript числата са плаващи и 0.1 + 0.2 !== 0.3. За пари това е
 * недопустимо, затова всяко парично и количествено пресмятане минава през
 * decimal.js. Стойностите се съхраняват като низове и се превръщат в Decimal
 * само за сметките — така в базата не влиза нито един float.
 */
Decimal.set({
  precision: 34,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -18,
  toExpPos: 30,
});

export { Decimal };

export const ZERO = new Decimal(0);

/** Безопасно създаване от каквото и да дойде — null/невалидно дава 0. */
export function dec(value: Decimal.Value | null | undefined): Decimal {
  if (value === null || value === undefined || value === '') return ZERO;
  try {
    const result = new Decimal(value);
    return result.isFinite() ? result : ZERO;
  } catch {
    return ZERO;
  }
}

/** Деление, което връща 0 вместо NaN/Infinity при делител 0. */
export function divSafe(numerator: Decimal, divisor: Decimal): Decimal {
  if (divisor.isZero()) return ZERO;
  return numerator.div(divisor);
}

/**
 * Парсва въведеното от потребителя — приема и запетая, и точка, и интервали
 * като разделител на хиляди. Връща null при невалиден вход.
 */
export function parseUserNumber(input: string): Decimal | null {
  const normalized = input
    .replace(/\s| /g, '')
    .replace(',', '.')
    .trim();

  if (normalized === '' || normalized === '.' || normalized === '-') return null;
  if (!/^-?\d*\.?\d*$/.test(normalized)) return null;

  try {
    const result = new Decimal(normalized);
    return result.isFinite() ? result : null;
  } catch {
    return null;
  }
}

/** Числата от API идват винаги с точка — парсваме ги строго. */
export function parseApiNumber(input: string | number | undefined | null): Decimal | null {
  if (input === undefined || input === null) return null;
  try {
    const result = new Decimal(input);
    return result.isFinite() ? result : null;
  } catch {
    return null;
  }
}

/** Низ за съхранение — без експоненциален запис. */
export function toStorage(value: Decimal): string {
  return value.toFixed();
}
