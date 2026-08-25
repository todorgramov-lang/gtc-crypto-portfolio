/**
 * Портфолиата — например „Анна" и „Тодор". Всяка транзакция принадлежи на
 * точно едно. Може да се гледа всяко поотделно или всички заедно.
 */

export interface Portfolio {
  id: string;
  name: string;
  /** Цвят за разпознаване с един поглед. */
  color: string;
}

/** Специална стойност за изгледа „всички заедно". */
export const ALL_PORTFOLIOS = 'all' as const;

export type PortfolioSelection = string | typeof ALL_PORTFOLIOS;

export const DEFAULT_PORTFOLIOS: Portfolio[] = [
  { id: 'anna', name: 'Анна', color: '#E879A6' },
  { id: 'todor', name: 'Тодор', color: '#5B9DFF' },
];

/** Палитра за избор на цвят при създаване и редакция. */
export const PORTFOLIO_COLORS: string[] = [
  '#E879A6', // розово
  '#5B9DFF', // синьо
  '#14F195', // зелено
  '#F7931A', // оранжево
  '#A78BFA', // лилаво
  '#4FE9CD', // тюркоазено
  '#FBBF24', // жълто
  '#F87171', // червено
];

export function portfolioById(
  portfolios: Portfolio[],
  id: string | null | undefined,
): Portfolio | undefined {
  if (!id) return undefined;
  return portfolios.find((portfolio) => portfolio.id === id);
}

/** Име за показване — включително за изгледа „общо". */
export function selectionName(
  portfolios: Portfolio[],
  selection: PortfolioSelection,
): string {
  if (selection === ALL_PORTFOLIOS) return 'Общо';
  return portfolioById(portfolios, selection)?.name ?? 'Общо';
}

/** Цвят на избраното; за „общо" няма собствен цвят. */
export function selectionColor(
  portfolios: Portfolio[],
  selection: PortfolioSelection,
): string | null {
  if (selection === ALL_PORTFOLIOS) return null;
  return portfolioById(portfolios, selection)?.color ?? null;
}

/** Прави идентификатор от името — за нови портфолиа и при импорт. */
export function makePortfolioId(name: string, existing: Portfolio[]): string {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-zа-я0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '') || 'portfolio';

  if (!existing.some((portfolio) => portfolio.id === base)) return base;

  let suffix = 2;
  while (existing.some((portfolio) => portfolio.id === `${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

/** Следващият неизползван цвят от палитрата. */
export function nextColor(existing: Portfolio[]): string {
  const used = new Set(existing.map((portfolio) => portfolio.color));
  return PORTFOLIO_COLORS.find((color) => !used.has(color)) ?? PORTFOLIO_COLORS[0]!;
}
