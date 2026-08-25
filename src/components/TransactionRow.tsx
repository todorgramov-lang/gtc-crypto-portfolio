import { assetInfo } from '../lib/assets';
import { formatDate, type Formatter } from '../lib/format';
import { isInflow, type Transaction, type TxType } from '../lib/types';
import { ALL_PORTFOLIOS, portfolioById } from '../lib/portfolios';
import { useApp } from '../store';

export const TYPE_LABEL: Record<TxType, string> = {
  buy: 'Покупка',
  sell: 'Продажба',
  transferIn: 'Входящ трансфер',
  transferOut: 'Изходящ трансфер',
};

const TYPE_GLYPH: Record<TxType, string> = {
  buy: '↓',
  sell: '↑',
  transferIn: '⇢',
  transferOut: '⇠',
};

interface Props {
  transaction: Transaction;
  formatter: Formatter;
  showAsset?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export default function TransactionRow({
  transaction,
  formatter,
  showAsset = true,
  onEdit,
  onDelete,
}: Props) {
  const { portfolios, selection } = useApp();

  const inflow = isInflow(transaction.type);
  const info = assetInfo(transaction.asset);

  // Чие е показваме само в общия изглед — иначе е излишно повторение.
  const owner =
    selection === ALL_PORTFOLIOS && portfolios.length > 1
      ? portfolioById(portfolios, transaction.portfolioId)
      : undefined;

  return (
    <li className="flex items-center gap-3 border-b border-ink-700/70 px-1 py-2.5 last:border-0">
      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span
          className={`num grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm ${
            inflow ? 'bg-profit/12 text-profit' : 'bg-loss/12 text-loss'
          }`}
          aria-hidden
        >
          {TYPE_GLYPH[transaction.type]}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            {owner && (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: owner.color }}
              />
            )}
            <span className="text-[13px] font-medium">{TYPE_LABEL[transaction.type]}</span>
            {showAsset && (
              <span className="num text-[13px] font-semibold" style={{ color: info.tint }}>
                {transaction.asset}
              </span>
            )}
          </span>

          <span className="block truncate text-[11px] text-fg-faint">
            {owner && `${owner.name} · `}
            {formatDate(transaction.date)}
            {transaction.exchange && ` · ${transaction.exchange}`}
            {transaction.note && ` · ${transaction.note}`}
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span
            className={`num block text-[13px] font-medium ${
              inflow ? 'text-profit' : 'text-loss'
            }`}
          >
            {inflow ? '+' : '−'}
            {formatter.quantity(transaction.quantity, transaction.asset)}
          </span>
          <span className="num block text-[11px] text-fg-faint">
            {formatter.price(transaction.pricePerUnit, transaction.asset)}
          </span>
        </span>
      </button>

      <button
        type="button"
        onClick={onDelete}
        aria-label="Изтрий транзакцията"
        className="shrink-0 rounded-lg px-2 py-1 text-fg-faint transition active:bg-loss/15 active:text-loss"
      >
        ✕
      </button>
    </li>
  );
}
