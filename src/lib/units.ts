import { Decimal, dec } from './money';
import { assetInfo, type AssetId } from './assets';

/**
 * Мерки за показване.
 *
 * Количествата се съхраняват винаги в каноничната мярка на актива — за
 * криптовалутите това е самата монета, за златото е тройунция, защото цената
 * идва в долари за унция. Тук става превръщането към и от мярката, която
 * потребителят е избрал да вижда.
 *
 * Изчисленията в calc.ts не знаят нищо за това и не бива да научават:
 * те работят само с канонични количества и цени за канонична единица.
 */

export type GoldUnit = 'oz' | 'g';

/** Точното съотношение по определение, не приблизително. */
export const GRAMS_PER_TROY_OUNCE = '31.1034768';

export const GOLD_UNITS: Array<{ id: GoldUnit; label: string; name: string }> = [
  { id: 'g', label: 'г', name: 'Грамове' },
  { id: 'oz', label: 'oz', name: 'Тройунции' },
];

/**
 * Колко канонични единици е една показвана.
 * За грам злато: 1 г = 1/31.1034768 тройунции.
 */
export function unitFactor(asset: AssetId, goldUnit: GoldUnit): Decimal {
  if (asset !== 'XAU' || goldUnit === 'oz') return dec(1);
  return dec(1).div(dec(GRAMS_PER_TROY_OUNCE));
}

/** Означението, което се пише след числото. */
export function unitLabel(asset: AssetId, goldUnit: GoldUnit): string {
  if (asset !== 'XAU') return asset;
  return goldUnit === 'g' ? 'г' : 'oz';
}

/** Как се нарича мярката в изречение — „цена за 1 грам". */
export function unitNameSingular(asset: AssetId, goldUnit: GoldUnit): string {
  if (asset !== 'XAU') return '1';
  return goldUnit === 'g' ? '1 грам' : '1 унция';
}

/** Съхранено количество → количество за показване. */
export function toDisplayQuantity(
  canonical: Decimal,
  asset: AssetId,
  goldUnit: GoldUnit,
): Decimal {
  const factor = unitFactor(asset, goldUnit);
  return factor.eq(1) ? canonical : canonical.div(factor);
}

/** Въведено количество → количество за съхранение. */
export function toCanonicalQuantity(
  display: Decimal,
  asset: AssetId,
  goldUnit: GoldUnit,
): Decimal {
  const factor = unitFactor(asset, goldUnit);
  return factor.eq(1) ? display : display.times(factor);
}

/**
 * Цена за канонична единица → цена за показваната.
 * Ако унцията е 4629 долара, грамът е 4629 × (1/31.1) ≈ 148.8.
 */
export function toDisplayPrice(
  canonical: Decimal,
  asset: AssetId,
  goldUnit: GoldUnit,
): Decimal {
  const factor = unitFactor(asset, goldUnit);
  return factor.eq(1) ? canonical : canonical.times(factor);
}

/** Въведена цена → цена за съхранение (за канонична единица). */
export function toCanonicalPrice(
  display: Decimal,
  asset: AssetId,
  goldUnit: GoldUnit,
): Decimal {
  const factor = unitFactor(asset, goldUnit);
  return factor.eq(1) ? display : display.div(factor);
}

/** Колко знака да се показват за количеството. */
export function quantityDecimals(asset: AssetId, goldUnit: GoldUnit): number {
  if (asset !== 'XAU') return 8;
  // Кюлчетата са цели грамове; повече от три знака е шум.
  return goldUnit === 'g' ? 3 : 4;
}

/** Има ли този актив избор на мярка изобщо. */
export function hasUnitChoice(asset: AssetId): boolean {
  return assetInfo(asset).canonicalUnit === 'oz';
}
