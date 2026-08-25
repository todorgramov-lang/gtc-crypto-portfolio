import { useEffect, useMemo, useState } from 'react';

import { assetInfo, type AssetId } from '../lib/assets';
import { computeHolding } from '../lib/calc';
import { CHART_RANGES, RANGE_LABELS, loadChart } from '../lib/chart';
import { money } from '../lib/format';
import type { ChartRange, PricePoint, PriceSource, Transaction } from '../lib/types';
import { toneClass } from '../components/AssetCard';
import FlashValue from '../components/FlashValue';
import PriceChart from '../components/PriceChart';
import TransactionRow from '../components/TransactionRow';
import { useApp } from '../store';

const SOURCE_LABEL: Record<PriceSource, string> = {
  binance: 'Източник: Binance (на живо)',
  hyperliquid: 'Източник: Hyperliquid (на живо)',
  coingecko: 'Източник: CoinGecko',
  cache: 'Източник: последно запазени цени',
};

interface Props {
  asset: AssetId;
  onBack: () => void;
  onEdit: (transaction: Transaction) => void;
  onAdd: () => void;
  onDelete: (transaction: Transaction) => void;
}

export default function AssetDetail({ asset, onBack, onEdit, onAdd, onDelete }: Props) {
  const { transactions, feed, settings, formatter, eurPerUsd } = useApp();

  const [range, setRange] = useState<ChartRange>('24h');
  const [points, setPoints] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const holding = useMemo(
    () => computeHolding(asset, transactions, feed.quotes[asset], settings.costBasis),
    [asset, transactions, feed.quotes, settings.costBasis],
  );

  const own = useMemo(
    () =>
      transactions
        .filter((tx) => tx.asset === asset)
        .sort((a, b) => b.date.getTime() - a.date.getTime()),
    [transactions, asset],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    loadChart(asset, range)
      .then((result) => {
        if (!cancelled) setPoints(result);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setPoints([]);
        setError(cause instanceof Error ? cause.message : 'Няма данни за графиката.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [asset, range]);

  // Графиката се показва в избраната валута — конвертираме точките.
  const rate = settings.currency === 'USD' ? 1 : eurPerUsd.toNumber();
  const displayPoints = useMemo(
    () => (rate === 1 ? points : points.map((p) => ({ time: p.time, close: p.close * rate }))),
    [points, rate],
  );

  const averageCost = holding.averageCost.gt(0)
    ? holding.averageCost.times(rate).toNumber()
    : null;

  const info = assetInfo(asset);
  const quote = feed.quotes[asset];

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-700 bg-ink-900/95 px-2 py-2.5 backdrop-blur">
        <button type="button" onClick={onBack} className="px-2 py-1 text-sm text-fg-muted">
          ‹ Назад
        </button>
        <span className="num text-sm font-semibold" style={{ color: info.tint }}>
          {asset}
        </span>
        <button type="button" onClick={onAdd} className="px-3 py-1 text-lg leading-none">
          +
        </button>
      </header>

      <div className="space-y-5 px-4 py-4">
        <section className="text-center">
          <FlashValue
            value={holding.currentPrice}
            text={formatter.price(holding.currentPrice, asset)}
            enabled={settings.priceFlash}
            className="block text-[28px] font-bold leading-none"
          />

          <div
            className={`mt-1.5 flex items-center justify-center gap-1.5 text-xs ${toneClass(
              holding.change24hPercent,
            )}`}
          >
            <span aria-hidden>{holding.change24hPercent.gte(0) ? '↑' : '↓'}</span>
            <span className="num font-medium">
              {formatter.signedPercent(holding.change24hPercent)}
            </span>
            <span className="text-fg-faint">за 24ч</span>
          </div>

          {quote && (
            <p className="mt-1 text-[10px] text-fg-faint">{SOURCE_LABEL[quote.source]}</p>
          )}
        </section>

        <section>
          <div className="mb-2 grid grid-cols-4 gap-1 rounded-xl bg-ink-700/60 p-1">
            {CHART_RANGES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRange(value)}
                className={`num rounded-lg py-1.5 text-[11px] font-medium transition ${
                  range === value ? 'bg-ink-500 text-fg' : 'text-fg-muted'
                }`}
              >
                {RANGE_LABELS[value]}
              </button>
            ))}
          </div>

          <PriceChart
            points={displayPoints}
            averageCost={averageCost}
            averageCostLabel={
              averageCost === null
                ? null
                : money(holding.averageCost.times(rate), settings.currency, info.priceDecimals)
            }
            loading={loading}
            error={error}
          />
        </section>

        <section className="rounded-2xl border border-ink-600/60 bg-ink-800/60 px-3.5">
          <Metric label="Наличност" value={formatter.quantity(holding.quantity, asset)} />
          <Metric label="Средна цена" value={formatter.price(holding.averageCost, asset)} />
          <Metric label="Текуща цена" value={formatter.price(holding.currentPrice, asset)} />
          <Metric label="Инвестирано" value={formatter.money(holding.invested)} />
          <Metric label="Текуща стойност" value={formatter.money(holding.currentValue)} />
          <Metric
            label="Нереализирана П/З"
            value={`${formatter.signedMoney(holding.unrealizedProfitLoss)}  ${formatter.signedPercent(
              holding.unrealizedProfitLossPercent,
            )}`}
            tone={toneClass(holding.unrealizedProfitLoss)}
          />
          <Metric
            label="Реализирана П/З"
            value={formatter.signedMoney(holding.realizedProfitLoss)}
            tone={toneClass(holding.realizedProfitLoss)}
            last
          />
        </section>

        <section>
          <h2 className="mb-1 px-1 text-xs font-medium text-fg-muted">Транзакции</h2>

          {own.length === 0 ? (
            <p className="px-1 py-3 text-xs text-fg-faint">
              Още няма транзакции по този актив.
            </p>
          ) : (
            <ul>
              {own.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  formatter={formatter}
                  showAsset={false}
                  onEdit={() => onEdit(transaction)}
                  onDelete={() => onDelete(transaction)}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
  last = false,
}: {
  label: string;
  value: string;
  tone?: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 py-2.5 ${
        last ? '' : 'border-b border-ink-700/60'
      }`}
    >
      <span className="text-xs text-fg-muted">{label}</span>
      <span className={`num text-right text-[13px] font-medium ${tone ?? ''}`}>{value}</span>
    </div>
  );
}
