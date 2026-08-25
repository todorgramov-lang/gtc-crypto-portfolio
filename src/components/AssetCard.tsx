import type { ReactNode } from 'react';

import { assetInfo } from '../lib/assets';
import type { Decimal } from '../lib/money';
import type { Formatter } from '../lib/format';
import type { Holding } from '../lib/types';
import FlashValue from './FlashValue';

interface Props {
  holding: Holding;
  formatter: Formatter;
  flashEnabled: boolean;
  onOpen: () => void;
}

/** Цвят според знака на стойността. */
export function toneClass(value: Decimal): string {
  if (value.gt(0)) return 'text-profit';
  if (value.lt(0)) return 'text-loss';
  return 'text-flat';
}

export default function AssetCard({ holding, formatter, flashEnabled, onOpen }: Props) {
  const info = assetInfo(holding.asset);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-2xl border border-ink-600/60 bg-ink-800/60 p-3.5 text-left transition active:scale-[0.99]"
      style={{ borderColor: `${info.tint}22` }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[15px] font-bold"
          style={{ backgroundColor: `${info.tint}1f`, color: info.tint }}
        >
          {info.glyph}
        </span>

        <span className="min-w-0">
          <span className="num block text-[15px] font-semibold leading-tight">
            {holding.asset}
          </span>
          <span className="block truncate text-[13px] leading-tight text-fg-faint">
            {info.name}
            {info.note && <span className="text-fg-faint/70"> · {info.note}</span>}
          </span>
        </span>

        <span className="ml-auto text-right">
          <FlashValue
            value={holding.currentPrice}
            text={formatter.price(holding.currentPrice, holding.asset)}
            enabled={flashEnabled}
            className="block text-base font-medium"
          />
          <span
            className={`num block text-[13px] ${toneClass(holding.change24hPercent)}`}
          >
            {formatter.signedPercent(holding.change24hPercent)}
          </span>
        </span>
      </div>

      {/*
        При по-едрия шрифт трите показателя не се събират на един ред върху
        375 пиксела, затова печалбата/загубата е на свой ред отдолу — там има
        място и за сумата, и за процента.
      */}
      <div className="mt-3 space-y-2 border-t border-ink-600/50 pt-2.5">
        <div className="flex items-start justify-between gap-3">
          <Metric label="Наличност">
            {formatter.quantity(holding.quantity, holding.asset)}
          </Metric>

          <Metric label="Стойност" align="right">
            {formatter.money(holding.currentValue)}
          </Metric>
        </div>

        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs text-fg-faint">Печалба / загуба</span>
          <span
            className={`num flex items-baseline gap-2 ${toneClass(
              holding.unrealizedProfitLoss,
            )}`}
          >
            <span className="text-sm font-medium">
              {formatter.signedMoney(holding.unrealizedProfitLoss)}
            </span>
            <span className="text-xs">
              {formatter.signedPercent(holding.unrealizedProfitLossPercent)}
            </span>
          </span>
        </div>
      </div>
    </button>
  );
}

function Metric({
  label,
  align = 'left',
  children,
}: {
  label: string;
  align?: 'left' | 'right';
  children: ReactNode;
}) {
  return (
    <span className={`min-w-0 ${align === 'right' ? 'text-right' : ''}`}>
      <span className="block text-xs leading-tight text-fg-faint">{label}</span>
      <span className="num block truncate text-sm leading-tight">{children}</span>
    </span>
  );
}
