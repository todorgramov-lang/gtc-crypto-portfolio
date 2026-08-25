import { assetInfo } from '../lib/assets';
import type { Formatter } from '../lib/format';
import type { Holding, Totals } from '../lib/types';
import { toneClass } from './AssetCard';
import FlashValue from './FlashValue';

interface Props {
  totals: Totals;
  holding: Holding | undefined;
  formatter: Formatter;
  flashEnabled: boolean;
  onOpen: () => void;
}

/**
 * Златото стои в собствен блок под общата стойност на криптото — нарочно
 * със своя сума, за да не се смесва с нея.
 */
export default function GoldCard({
  totals,
  holding,
  formatter,
  flashEnabled,
  onOpen,
}: Props) {
  if (!holding || !totals.hasActivity) return null;

  const info = assetInfo(holding.asset);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-2xl border p-3.5 text-left transition active:scale-[0.99]"
      style={{
        borderColor: `${info.tint}33`,
        backgroundColor: `${info.tint}0f`,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <span
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-bold"
            style={{ backgroundColor: `${info.tint}26`, color: info.tint }}
          >
            {info.glyph}
          </span>
          <span
            className="text-sm font-semibold uppercase tracking-wide"
            style={{ color: info.tint }}
          >
            {info.name}
          </span>
        </span>

        <span className="num text-sm text-fg-muted">
          {formatter.quantity(holding.quantity, holding.asset)}
        </span>
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-3">
        <FlashValue
          value={totals.value}
          text={formatter.money(totals.value)}
          enabled={flashEnabled}
          className="text-[22px] font-bold"
        />

        <span className={`num flex items-baseline gap-2 ${toneClass(totals.profitLoss)}`}>
          <span className="text-sm font-medium">
            {formatter.signedMoney(totals.profitLoss)}
          </span>
          <span className="text-xs">{formatter.signedPercent(totals.profitLossPercent)}</span>
        </span>
      </div>

      <div className="mt-1 flex items-center justify-between gap-3 text-xs">
        <span className="text-fg-faint">
          Цена {formatter.price(holding.currentPrice, holding.asset)}
        </span>
        <span className={`num ${toneClass(totals.change24hValue)}`}>
          24ч {formatter.signedPercent(totals.change24hPercent)}
        </span>
      </div>
    </button>
  );
}
