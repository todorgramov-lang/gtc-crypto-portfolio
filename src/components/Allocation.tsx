import { assetGroup, assetInfo } from '../lib/assets';
import { percent } from '../lib/format';
import type { PortfolioSummary } from '../lib/types';

/**
 * Разпределение по активи — donut отляво, легенда отдясно, тънък хоризонтален
 * bar отдолу като по-компактен втори прочит.
 */
export default function Allocation({ summary }: { summary: PortfolioSummary }) {
  const slices = summary.holdings
    .filter(
      (holding) =>
        assetGroup(holding.asset) === 'crypto' &&
        holding.quantity.gt(0) &&
        holding.currentValue.gt(0),
    )
    .sort((a, b) => b.currentValue.comparedTo(a.currentValue));

  if (slices.length === 0) return null;

  const RADIUS = 42;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  let offset = 0;

  return (
    <section className="rounded-2xl border border-ink-600/60 bg-ink-800/60 p-4">
      <h2 className="mb-3 text-sm font-medium text-fg-muted">Разпределение на криптото</h2>

      <div className="flex items-center gap-5">
        <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0 -rotate-90">
          {slices.map((holding) => {
            const share = summary.allocation[holding.asset].toNumber() / 100;
            const length = share * CIRCUMFERENCE;
            const dash = `${length} ${CIRCUMFERENCE - length}`;
            const currentOffset = offset;
            offset -= length;

            return (
              <circle
                key={holding.asset}
                cx="50"
                cy="50"
                r={RADIUS}
                fill="none"
                stroke={assetInfo(holding.asset).tint}
                strokeWidth="15"
                strokeDasharray={dash}
                strokeDashoffset={currentOffset}
              />
            );
          })}
        </svg>

        <ul className="flex-1 space-y-1.5">
          {slices.map((holding) => (
            <li key={holding.asset} className="flex items-center gap-2 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: assetInfo(holding.asset).tint }}
              />
              <span className="num font-medium">{holding.asset}</span>
              <span className="num ml-auto text-fg-muted">
                {percent(summary.allocation[holding.asset])}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
        {slices.map((holding) => (
          <span
            key={holding.asset}
            className="rounded-full"
            style={{
              backgroundColor: assetInfo(holding.asset).tint,
              width: `${summary.allocation[holding.asset].toNumber()}%`,
            }}
          />
        ))}
      </div>
    </section>
  );
}
