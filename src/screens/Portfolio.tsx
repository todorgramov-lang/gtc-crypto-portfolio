import type { AssetId } from '../lib/assets';
import Allocation from '../components/Allocation';
import AssetCard, { toneClass } from '../components/AssetCard';
import ConnectionDot from '../components/ConnectionDot';
import PortfolioSwitcher from '../components/PortfolioSwitcher';
import ExchangeSwitcher from '../components/ExchangeSwitcher';
import EmptyState from '../components/EmptyState';
import FlashValue from '../components/FlashValue';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { useApp } from '../store';

interface Props {
  onOpenAsset: (asset: AssetId) => void;
  onAddTransaction: () => void;
}

export default function Portfolio({ onOpenAsset, onAddTransaction }: Props) {
  const { summary, formatter, settings, transactions, allTransactions, refresh } = useApp();
  const { containerRef, pull, refreshing } = usePullToRefresh(refresh);

  const hasTransactions = transactions.length > 0;
  /**
   * Празно заради филтър е друго нещо от наистина празно портфолио —
   * иначе съобщението подканва да добавиш първа сделка, когато вече имаш.
   */
  const emptyBecauseOfFilter = !hasTransactions && allTransactions.length > 0;

  return (
    <div ref={containerRef} className="h-full overflow-y-auto overscroll-contain">
      <div
        className="grid place-items-center overflow-hidden text-[13px] text-fg-faint transition-[height]"
        style={{ height: refreshing ? 28 : pull }}
      >
        {refreshing ? 'Обновяване…' : pull > 0 ? 'Пусни за обновяване' : ''}
      </div>

      <div className="space-y-4 px-4 pb-6">
        <div className="space-y-2 pt-3">
          <PortfolioSwitcher />
          <ExchangeSwitcher />
        </div>

        <header className="text-center">
          <ConnectionDot />

          <FlashValue
            value={summary.totalValue}
            text={formatter.money(summary.totalValue)}
            enabled={settings.priceFlash}
            className="mt-3 block text-[36px] font-bold leading-none"
          />

          <div
            className={`mt-2 flex items-center justify-center gap-2 text-base font-semibold ${toneClass(
              summary.totalProfitLoss,
            )}`}
          >
            <span className="num">{formatter.signedMoney(summary.totalProfitLoss)}</span>
            <span className="num">
              {formatter.signedPercent(summary.totalProfitLossPercent)}
            </span>
          </div>

          <div
            className={`mt-1 flex items-center justify-center gap-1.5 text-sm ${toneClass(
              summary.change24hValue,
            )}`}
          >
            <span aria-hidden>{summary.change24hValue.gte(0) ? '↑' : '↓'}</span>
            <span className="text-fg-faint">24ч</span>
            <span className="num">{formatter.signedMoney(summary.change24hValue)}</span>
            <span className="num">
              ({formatter.signedPercent(summary.change24hPercent)})
            </span>
          </div>

          {!summary.totalRealizedProfitLoss.isZero() && (
            <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[13px]">
              <span className="text-fg-faint">Реализирана П/З</span>
              <span className={`num ${toneClass(summary.totalRealizedProfitLoss)}`}>
                {formatter.signedMoney(summary.totalRealizedProfitLoss)}
              </span>
            </div>
          )}
        </header>

        {hasTransactions && <Allocation summary={summary} />}

        {!hasTransactions &&
          (emptyBecauseOfFilter ? (
            <EmptyState
              title="Няма нищо за този избор"
              message="Тук няма транзакции при текущото портфолио и борса. Върни се на „Общо“ или „Всички“, за да видиш всичко."
            />
          ) : (
            <EmptyState
              title="Празно портфолио"
              message="Натисни + горе вдясно, избери актив и тип „Покупка“, въведи количество и цена. Останалото се изчислява само."
              actionLabel="Добави първа транзакция"
              onAction={onAddTransaction}
            />
          ))}

        <div className="space-y-2.5">
          {summary.holdings.map((holding) => (
            <AssetCard
              key={holding.asset}
              holding={holding}
              formatter={formatter}
              flashEnabled={settings.priceFlash}
              onOpen={() => onOpenAsset(holding.asset)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
