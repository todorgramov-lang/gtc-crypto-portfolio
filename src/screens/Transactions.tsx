import { useMemo, useState, type ReactNode } from 'react';

import { ASSET_IDS, type AssetId } from '../lib/assets';
import { formatMonth, monthKey } from '../lib/format';
import type { Transaction, TxType } from '../lib/types';
import EmptyState from '../components/EmptyState';
import TransactionRow, { TYPE_LABEL } from '../components/TransactionRow';
import ExchangeSwitcher from '../components/ExchangeSwitcher';
import { useApp } from '../store';

interface Props {
  onEdit: (transaction: Transaction) => void;
  onAdd: () => void;
  onDelete: (transaction: Transaction) => void;
}

export default function Transactions({ onEdit, onAdd, onDelete }: Props) {
  const { transactions, formatter, exchangeFilter } = useApp();

  const [assetFilter, setAssetFilter] = useState<AssetId | null>(null);
  const [typeFilter, setTypeFilter] = useState<TxType | null>(null);

  const filtered = useMemo(
    () =>
      transactions
        .filter((tx) => (assetFilter ? tx.asset === assetFilter : true))
        .filter((tx) => (typeFilter ? tx.type === typeFilter : true))
        .sort((a, b) => b.date.getTime() - a.date.getTime()),
    [transactions, assetFilter, typeFilter],
  );

  /** Групиране по месец — най-новият най-отгоре. */
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; items: Transaction[] }>();

    for (const tx of filtered) {
      const key = monthKey(tx.date);
      const existing = map.get(key);
      if (existing) existing.items.push(tx);
      else map.set(key, { label: formatMonth(tx.date), items: [tx] });
    }

    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const hasFilter = assetFilter !== null || typeFilter !== null || exchangeFilter !== null;

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <header className="sticky top-0 z-10 border-b border-ink-700 bg-ink-900/95 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold">Транзакции</h1>
          <button type="button" onClick={onAdd} className="px-2 text-xl leading-none">
            +
          </button>
        </div>

        <div className="no-scrollbar -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          <Chip active={!hasFilter} onClick={() => { setAssetFilter(null); setTypeFilter(null); }}>
            Всички
          </Chip>

          {ASSET_IDS.map((id) => (
            <Chip
              key={id}
              active={assetFilter === id}
              onClick={() => setAssetFilter(assetFilter === id ? null : id)}
            >
              {id}
            </Chip>
          ))}

          <span className="my-1 w-px shrink-0 bg-ink-600" aria-hidden />

          {(Object.keys(TYPE_LABEL) as TxType[]).map((value) => (
            <Chip
              key={value}
              active={typeFilter === value}
              onClick={() => setTypeFilter(typeFilter === value ? null : value)}
            >
              {TYPE_LABEL[value]}
            </Chip>
          ))}
        </div>

        <div className="mt-2">
          <ExchangeSwitcher />
        </div>
      </header>

      <div className="px-4 py-3">
        {groups.length === 0 ? (
          <EmptyState
            title={hasFilter ? 'Няма съвпадения' : 'Няма транзакции'}
            message={
              hasFilter
                ? 'Промени или изчисти филтрите.'
                : 'Добави първата си сделка, за да следиш наличности и печалба.'
            }
            actionLabel={hasFilter ? undefined : 'Добави транзакция'}
            onAction={hasFilter ? undefined : onAdd}
          />
        ) : (
          groups.map(([key, group]) => (
            <section key={key} className="mb-4">
              <h2 className="mb-1 px-1 text-[13px] font-medium uppercase tracking-wide text-fg-faint">
                {group.label}
              </h2>
              <ul>
                {group.items.map((transaction) => (
                  <TransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    formatter={formatter}
                    onEdit={() => onEdit(transaction)}
                    onDelete={() => onDelete(transaction)}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1 text-[13px] font-medium transition ${
        active ? 'bg-fg text-ink-900' : 'bg-ink-700 text-fg-muted'
      }`}
    >
      {children}
    </button>
  );
}
