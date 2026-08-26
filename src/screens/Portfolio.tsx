import { assetGroup, assetInfo, type AssetId } from '../lib/assets';
import Allocation from '../components/Allocation';
import AssetCard from '../components/AssetCard';
import ConnectionDot from '../components/ConnectionDot';
import PortfolioSwitcher from '../components/PortfolioSwitcher';
import ExchangeSwitcher from '../components/ExchangeSwitcher';
import SummaryCard from '../components/SummaryCard';
import EmptyState from '../components/EmptyState';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { useApp } from '../store';

interface Props {
  onOpenAsset: (asset: AssetId) => void;
  onAddTransaction: (asset?: AssetId) => void;
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

  const gold = summary.holdings.find((holding) => holding.asset === 'XAU');

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

        <ConnectionDot />

        {/*
          Двете стойности се рисуват от една и съща обвивка — крипто и злато
          изглеждат еднакво и стоят едно до друго, без едното да е заглавие,
          а другото карта.
        */}
        <div className="space-y-2.5">
          <SummaryCard
            label="Крипто"
            totals={summary.crypto}
            formatter={formatter}
            flashEnabled={settings.priceFlash}
          />

          {gold && (
            <SummaryCard
              label="Злато"
              accent={assetInfo('XAU').tint}
              totals={summary.metal}
              formatter={formatter}
              flashEnabled={settings.priceFlash}
              aside={
                summary.metal.hasActivity
                  ? formatter.quantity(gold.quantity, 'XAU')
                  : undefined
              }
              onClick={() =>
                summary.metal.hasActivity ? onOpenAsset('XAU') : onAddTransaction('XAU')
              }
              emptyValue={
                summary.metal.hasActivity
                  ? undefined
                  : {
                      value: gold.currentPrice,
                      text: formatter.price(gold.currentPrice, 'XAU'),
                      change: gold.change24hPercent,
                      hint: 'Още нямаш злато. Натисни, за да добавиш покупка.',
                    }
              }
            />
          )}
        </div>

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
