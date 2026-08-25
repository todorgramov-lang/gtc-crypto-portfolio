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
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-bold"
          style={{ backgroundColor: `${info.tint}1f`, color: info.tint }}
        >
          {holding.asset.slice(0, 1)}
        </span>

        <span className="min-w-0">
          <span className="num block text-[15px] font-semibold leading-tight">
            {holding.asset}
          </span>
          <span className="block truncate text-[11px] leading-tight text-fg-faint">
            {info.name}
          </span>
        </span>

        <span className="ml-auto text-right">
          <FlashValue
            value={holding.currentPrice}
            text={formatter.price(holding.currentPrice, holding.asset)}
            enabled={flashEnabled}
            className="block text-sm font-medium"
          />
          <span
            className={`num block text-[11px] ${toneClass(holding.change24hPercent)}`}
          >
            {formatter.signedPercent(holding.change24hPercent)}
          </span>
        </span>
      </div>

      <div className="mt-3 border-t border-ink-600/50 pt-2.5">
        <div className="flex items-start justify-between gap-3">
          <Metric label="Наличност">
            {formatter.quantity(holding.quantity, holding.asset)}
          </Metric>

          <Metric label="Стойност" align="right">
            {formatter.money(holding.currentValue)}
          </Metric>

          <Metric label="П/З" align="right">
            <span className={toneClass(holding.unrealizedProfitLoss)}>
              {formatter.signedMoney(holding.unrealizedProfitLoss)}
              <span className="ml-1 text-[10px]">
                {formatter.signedPercent(holding.unrealizedProfitLossPercent)}
              </span>
            </span>
          </Metric>
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
      <span className="block text-[10px] leading-tight text-fg-faint">{label}</span>
      <span className="num block truncate text-xs leading-tight">{children}</span>
    </span>
  );
}
