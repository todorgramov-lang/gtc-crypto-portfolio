import { useMemo, type ReactNode } from 'react';

import type { PricePoint } from '../lib/types';

interface Props {
  points: PricePoint[];
  /** Средна цена на покупка в показваната валута — жълтата пунктирана линия. */
  averageCost: number | null;
  averageCostLabel: string | null;
  /** Текуща цена в показваната валута — линията на нивото „сега". */
  currentPrice: number | null;
  currentPriceLabel: string | null;
  loading: boolean;
  error: string | null;
}

const WIDTH = 320;
const HEIGHT = 160;
const PADDING_TOP = 12;
const PADDING_BOTTOM = 16;

/**
 * Графика на цената. Рисувана директно като SVG — няма нужда от библиотека за
 * една линия, а така се зарежда мигновено и се вписва точно в темата.
 */
export default function PriceChart({
  points,
  averageCost,
  averageCostLabel,
  currentPrice,
  currentPriceLabel,
  loading,
  error,
}: Props) {
  const geometry = useMemo(() => {
    if (points.length < 2) return null;

    const values = points.map((point) => point.close);
    let min = Math.min(...values);
    let max = Math.max(...values);

    // И двете линии трябва да се побират, иначе излизат извън рамката.
    for (const level of [averageCost, currentPrice]) {
      if (level === null) continue;
      min = Math.min(min, level);
      max = Math.max(max, level);
    }

    if (max === min) {
      min -= 1;
      max += 1;
    }

    const span = max - min;
    const padded = { min: min - span * 0.08, max: max + span * 0.08 };
    const range = padded.max - padded.min;

    const x = (index: number) => (index / (points.length - 1)) * WIDTH;
    const y = (value: number) =>
      PADDING_TOP +
      (1 - (value - padded.min) / range) * (HEIGHT - PADDING_TOP - PADDING_BOTTOM);

    const line = points.map((point, index) => `${x(index)},${y(point.close)}`).join(' ');
    const area = `${line} ${WIDTH},${HEIGHT} 0,${HEIGHT}`;

    const first = values[0]!;
    const last = values[values.length - 1]!;
    const rising = last >= first;

    return {
      line,
      area,
      rising,
      averageY: averageCost !== null ? y(averageCost) : null,
      currentY: currentPrice !== null ? y(currentPrice) : null,
    };
  }, [points, averageCost, currentPrice]);

  if (loading && !geometry) {
    return <Placeholder>Зареждане…</Placeholder>;
  }

  if (!geometry) {
    return <Placeholder>{error ?? 'Няма данни за графиката.'}</Placeholder>;
  }

  const stroke = geometry.rising ? 'var(--color-profit)' : 'var(--color-loss)';

  return (
    <div className={`relative ${loading ? 'opacity-50' : ''}`}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-40 w-full"
        role="img"
        aria-label="Графика на цената"
      >
        <defs>
          <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>

        <polygon points={geometry.area} fill="url(#area-fill)" />

        <polyline
          points={geometry.line}
          fill="none"
          stroke={stroke}
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {geometry.averageY !== null && (
          <line
            x1="0"
            x2={WIDTH}
            y1={geometry.averageY}
            y2={geometry.averageY}
            stroke="var(--color-warn)"
            strokeWidth="1"
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* Текущата цена — плътна линия в цвета на графиката. */}
        {geometry.currentY !== null && (
          <line
            x1="0"
            x2={WIDTH}
            y1={geometry.currentY}
            y2={geometry.currentY}
            stroke={stroke}
            strokeWidth="1"
            strokeOpacity="0.55"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {/*
        Етикетите стоят на височината на своята линия. SVG-то е разтеглено
        линейно, затова процентът се смята направо от координатата.
      */}
      {geometry.currentY !== null && currentPriceLabel && (
        <span
          className="num pointer-events-none absolute right-0 -translate-y-1/2 rounded px-1.5 py-0.5 text-[10px] font-medium"
          style={{
            top: `${(geometry.currentY / HEIGHT) * 100}%`,
            color: stroke,
            backgroundColor: 'color-mix(in oklab, var(--color-ink-900) 82%, transparent)',
          }}
        >
          сега {currentPriceLabel}
        </span>
      )}

      {geometry.averageY !== null && averageCostLabel && (
        <span
          className="num pointer-events-none absolute left-0 -translate-y-1/2 rounded bg-warn/15 px-1.5 py-0.5 text-[10px] text-warn"
          style={{ top: `${(geometry.averageY / HEIGHT) * 100}%` }}
        >
          средна {averageCostLabel}
        </span>
      )}
    </div>
  );
}

function Placeholder({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-40 place-items-center rounded-xl bg-ink-700/40 px-4 text-center text-xs text-fg-faint">
      {children}
    </div>
  );
}
