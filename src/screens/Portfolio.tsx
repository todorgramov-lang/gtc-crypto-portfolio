import { assetGroup, type AssetId } from '../lib/assets';
import Allocation from '../components/Allocation';
import AssetCard, { toneClass } from '../components/AssetCard';
import ConnectionDot from '../components/ConnectionDot';
import PortfolioSwitcher from '../components/PortfolioSwitcher';
import ExchangeSwitcher from '../components/ExchangeSwitcher';
import GoldCard from '../components/GoldCard';
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

        {/* Голямото число е само криптото — златото има свой блок отдолу. */}
        <header className="text-center">
          <ConnectionDot />

          {summary.metal.hasActivity && (
            <p className="mt-3 text-xs font-medium uppercase tracking-wider text-fg-faint">
              Крипто
            </p>
          )}

          <FlashValue
            value={summary.crypto.value}
            text={formatter.money(summary.crypto.value)}
            enabled={settings.priceFlash}
            className={`block text-[36px] font-bold leading-none ${
              summary.metal.hasActivity ? 'mt-1' : 'mt-3'
            }`}
          />

          <div
            className={`mt-2 flex items-center justify-center gap-2 text-base font-semibold ${toneClass(
              summary.crypto.profitLoss,
            )}`}
          >
            <span className="num">{formatter.signedMoney(summary.crypto.profitLoss)}</span>
            <span className="num">
              {formatter.signedPercent(summary.crypto.profitLossPercent)}
            </span>
          </div>

          <div
            className={`mt-1 flex items-center justify-center gap-1.5 text-sm ${toneClass(
              summary.crypto.change24hValue,
            )}`}
          >
            <span aria-hidden>{summary.crypto.change24hValue.gte(0) ? '↑' : '↓'}</span>
            <span className="text-fg-faint">24ч</span>
            <span className="num">{formatter.signedMoney(summary.crypto.change24hValue)}</span>
            <span className="num">
              ({formatter.signedPercent(summary.crypto.change24hPercent)})
            </span>
          </div>

          {!summary.crypto.realizedProfitLoss.isZero() && (
            <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[13px]">
              <span className="text-fg-faint">Реализирана П/З</span>
              <span className={`num ${toneClass(summary.crypto.realizedProfitLoss)}`}>
                {formatter.signedMoney(summary.crypto.realizedProfitLoss)}
              </span>
            </div>
          )}
        </header>

        <GoldCard
          totals={summary.metal}
          holding={summary.holdings.find((h) => h.asset === 'XAU')}
          formatter={formatter}
          flashEnabled={settings.priceFlash}
          onOpen={() => onOpenAsset('XAU')}
        />

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
          {summary.holdings
            .filter((holding) => assetGroup(holding.asset) === 'crypto')
            .map((holding) => (
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
