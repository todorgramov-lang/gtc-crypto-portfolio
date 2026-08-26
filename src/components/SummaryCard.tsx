import type { ReactNode } from 'react';

import type { Formatter } from '../lib/format';
import type { Decimal } from '../lib/money';
import type { Totals } from '../lib/types';
import { toneClass } from './AssetCard';
import FlashValue from './FlashValue';

interface Props {
  /** КРИПТО, ЗЛАТО — изписва се с главни букви. */
  label: string;
  /** Цвят на заглавието; по подразбиране приглушеното сиво. */
  accent?: string;
  totals: Totals;
  formatter: Formatter;
  flashEnabled: boolean;
  /** Дясната страна на заглавния ред — например количеството злато. */
  aside?: ReactNode;
  /** Ако е подаден, картата е бутон. */
  onClick?: () => void;
  /** Показва се вместо сумите, когато групата е празна. */
  emptyValue?: { value: Decimal; text: string; hint: string; change: Decimal };
}

/**
 * Едната стойност на портфолиото — крипто или злато. Двете използват тази
 * обвивка нарочно: така не могат да се разминат по вид, колкото и да се пипа
 * едната.
 */
export default function SummaryCard({
  label,
  accent,
  totals,
  formatter,
  flashEnabled,
  aside,
  onClick,
  emptyValue,
}: Props) {
  const Wrapper = onClick ? 'button' : 'div';
  const isEmpty = Boolean(emptyValue);

  return (
    <Wrapper
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={`w-full rounded-2xl border border-ink-600/60 bg-ink-800/60 px-4 py-3.5 text-left ${
        onClick ? 'transition active:scale-[0.99]' : ''
      }`}
    >
      {/*
        Фиксирана височина на заглавния ред: иначе картата с количество отдясно
        става с няколко пиксела по-висока от тази без, и двете вече не изглеждат
        еднакво.
      */}
      <div className="flex h-5 items-baseline justify-between gap-3">
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: accent ?? 'var(--color-fg-faint)' }}
        >
          {label}
        </span>
        {aside && <span className="num text-sm text-fg-muted">{aside}</span>}
      </div>

      {isEmpty && emptyValue ? (
        <>
          <FlashValue
            value={emptyValue.value}
            text={emptyValue.text}
            enabled={flashEnabled}
            className="mt-1.5 block text-[28px] font-bold leading-none"
          />
          <div className={`mt-2 text-sm ${toneClass(emptyValue.change)}`}>
            <span className="text-fg-faint">24ч </span>
            <span className="num">{formatter.signedPercent(emptyValue.change)}</span>
          </div>
          <p className="mt-1.5 text-xs text-fg-faint">{emptyValue.hint}</p>
        </>
      ) : (
        <>
          <FlashValue
            value={totals.value}
            text={formatter.money(totals.value)}
            enabled={flashEnabled}
            className="mt-1.5 block text-[28px] font-bold leading-none"
          />

          <div
            className={`mt-2 flex items-baseline gap-2 text-sm font-semibold ${toneClass(
              totals.profitLoss,
            )}`}
          >
            <span className="num">{formatter.signedMoney(totals.profitLoss)}</span>
            <span className="num">{formatter.signedPercent(totals.profitLossPercent)}</span>
          </div>

          <div
            className={`mt-1 flex items-baseline gap-1.5 text-sm ${toneClass(
              totals.change24hValue,
            )}`}
          >
            <span className="text-fg-faint">24ч</span>
            <span className="num">{formatter.signedMoney(totals.change24hValue)}</span>
            <span className="num">
              ({formatter.signedPercent(totals.change24hPercent)})
            </span>
          </div>

          {!totals.realizedProfitLoss.isZero() && (
            <div className="mt-1 flex items-baseline gap-1.5 text-xs">
              <span className="text-fg-faint">Реализирана</span>
              <span className={`num ${toneClass(totals.realizedProfitLoss)}`}>
                {formatter.signedMoney(totals.realizedProfitLoss)}
              </span>
            </div>
          )}
        </>
      )}
    </Wrapper>
  );
}
