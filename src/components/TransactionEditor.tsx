import { useMemo, useState, type ReactNode } from 'react';

import { ASSET_IDS, assetInfo, type AssetId } from '../lib/assets';
import { availableQuantity } from '../lib/calc';
import { money, quantityWithSymbol, csvNumber } from '../lib/format';
import { parseUserNumber, ZERO } from '../lib/money';
import { newId } from '../lib/storage';
import { isOutflow, type Transaction, type TxType } from '../lib/types';
import { useApp } from '../store';
import { TYPE_LABEL } from './TransactionRow';

export type EditorMode = { kind: 'create'; asset?: AssetId } | { kind: 'edit'; transaction: Transaction };

interface Props {
  mode: EditorMode;
  onClose: () => void;
}

/** Полетата за дата искат `YYYY-MM-DDTHH:mm` в местно време. */
function toInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export default function TransactionEditor({ mode, onClose }: Props) {
  const app = useApp();
  const editing = mode.kind === 'edit' ? mode.transaction : null;

  const [asset, setAsset] = useState<AssetId>(
    editing?.asset ?? (mode.kind === 'create' ? mode.asset : undefined) ?? 'BTC',
  );
  const [type, setType] = useState<TxType>(editing?.type ?? 'buy');
  const [quantityText, setQuantityText] = useState(
    editing ? csvNumber(editing.quantity) : '',
  );
  const [priceText, setPriceText] = useState(
    editing ? csvNumber(editing.pricePerUnit) : '',
  );
  const [feeText, setFeeText] = useState(
    editing && !editing.fee.isZero() ? csvNumber(editing.fee) : '',
  );
  const [dateText, setDateText] = useState(toInputValue(editing?.date ?? new Date()));
  const [exchange, setExchange] = useState(
    editing?.exchange ?? app.transactions[0]?.exchange ?? '',
  );
  const [note, setNote] = useState(editing?.note ?? '');
  const [portfolioId, setPortfolioId] = useState(
    editing?.portfolioId ?? app.defaultPortfolioId,
  );
  const [saving, setSaving] = useState(false);

  const quantity = parseUserNumber(quantityText);
  const pricePerUnit = parseUserNumber(priceText);
  const fee = parseUserNumber(feeText) ?? ZERO;

  /**
   * Наличността е на портфолиото, в което влиза сделката — не на общото.
   * Анна не може да продаде от монетите на Тодор.
   */
  const available = useMemo(
    () =>
      availableQuantity(
        asset,
        app.allTransactions.filter((tx) => tx.portfolioId === portfolioId),
        editing?.id,
      ),
    [asset, app.allTransactions, portfolioId, editing?.id],
  );

  const marketPrice = app.feed.quotes[asset]?.price ?? null;

  /** Обща стойност на сделката, преизчислявана докато въвеждаш. */
  const total = useMemo(() => {
    if (!quantity || !pricePerUnit) return ZERO;
    const gross = quantity.times(pricePerUnit);
    return isOutflow(type) ? gross.minus(fee) : gross.plus(fee);
  }, [quantity, pricePerUnit, fee, type]);

  const error = useMemo(() => {
    if (!quantity || quantity.lte(0)) return 'Въведи количество, по-голямо от нула.';
    if (!pricePerUnit || pricePerUnit.lt(0)) return 'Въведи валидна цена.';
    if ((type === 'buy' || type === 'sell') && pricePerUnit.isZero()) {
      return 'Въведи валидна цена.';
    }
    if (fee.lt(0)) return 'Таксата не може да е отрицателна.';
    if (isOutflow(type) && quantity.gt(available)) {
      return `Нямаш толкова. Разполагаш с ${quantityWithSymbol(available, asset)}.`;
    }
    if (Number.isNaN(Date.parse(dateText))) return 'Въведи валидна дата.';
    return null;
  }, [quantity, pricePerUnit, fee, type, available, asset, dateText]);

  async function handleSave() {
    if (error || !quantity || !pricePerUnit || saving) return;
    setSaving(true);

    const transaction: Transaction = {
      id: editing?.id ?? newId(),
      asset,
      type,
      quantity,
      pricePerUnit,
      fee,
      date: new Date(dateText),
      exchange: exchange.trim(),
      note: note.trim() === '' ? null : note.trim(),
      portfolioId,
    };

    if (editing) await app.updateTransaction(transaction);
    else await app.addTransaction(transaction);

    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Затвори"
        className="flex-1"
        onClick={onClose}
      />

      <div className="pb-safe max-h-[92vh] overflow-y-auto rounded-t-3xl border-t border-ink-600 bg-ink-800">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-700 bg-ink-800/95 px-4 py-3 backdrop-blur">
          <button type="button" onClick={onClose} className="text-base text-fg-muted">
            Отказ
          </button>
          <h2 className="text-base font-semibold">
            {editing ? 'Редакция' : 'Нова транзакция'}
          </h2>
          <button
            type="button"
            onClick={handleSave}
            disabled={error !== null || saving}
            className="text-base font-semibold text-profit disabled:text-fg-faint"
          >
            Запази
          </button>
        </header>

        <div className="space-y-5 px-4 py-4">
          {app.portfolios.length > 1 && (
            <Field label="Портфолио">
              <div className="grid grid-cols-2 gap-1.5">
                {app.portfolios.map((portfolio) => {
                  const active = portfolioId === portfolio.id;

                  return (
                    <button
                      key={portfolio.id}
                      type="button"
                      onClick={() => setPortfolioId(portfolio.id)}
                      className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium transition ${
                        active ? 'text-ink-900' : 'bg-ink-700 text-fg-muted'
                      }`}
                      style={active ? { backgroundColor: portfolio.color } : undefined}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor: active ? 'rgb(0 0 0 / 0.35)' : portfolio.color,
                        }}
                      />
                      {portfolio.name}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          <Field label="Актив">
            <div className="grid grid-cols-4 gap-1.5">
              {ASSET_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAsset(id)}
                  className={`num rounded-xl py-2 text-sm font-semibold transition ${
                    asset === id ? 'text-ink-900' : 'bg-ink-700 text-fg-muted'
                  }`}
                  style={asset === id ? { backgroundColor: assetInfo(id).tint } : undefined}
                >
                  {id}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Тип">
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(TYPE_LABEL) as TxType[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  className={`rounded-xl py-2 text-sm font-medium transition ${
                    type === value ? 'bg-fg text-ink-900' : 'bg-ink-700 text-fg-muted'
                  }`}
                >
                  {TYPE_LABEL[value]}
                </button>
              ))}
            </div>
          </Field>

          <NumberField
            label="Количество"
            value={quantityText}
            onChange={setQuantityText}
            placeholder="0.00000000"
            suffix={asset}
          />

          <div>
            <NumberField
              label="Цена за 1"
              value={priceText}
              onChange={setPriceText}
              placeholder="0.00"
              suffix="USD"
            />
            {marketPrice && (
              <button
                type="button"
                onClick={() =>
                  setPriceText(
                    csvNumber(marketPrice.toDecimalPlaces(assetInfo(asset).priceDecimals)),
                  )
                }
                className="mt-1.5 flex w-full items-center justify-between rounded-lg bg-ink-700/60 px-3 py-2 text-[13px] text-fg-muted"
              >
                <span>Използвай текущата цена</span>
                <span className="num">{money(marketPrice, 'USD', assetInfo(asset).priceDecimals)}</span>
              </button>
            )}
          </div>

          <NumberField
            label="Такса"
            value={feeText}
            onChange={setFeeText}
            placeholder="0.00"
            suffix="USD"
          />

          <div className="rounded-xl bg-ink-700/50 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-fg-muted">Обща стойност</span>
              <span className="num text-base font-semibold">{money(total, 'USD')}</span>
            </div>

            {isOutflow(type) && (
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[13px] text-fg-faint">Налично</span>
                <span
                  className={`num text-[13px] ${available.gt(0) ? 'text-fg-muted' : 'text-loss'}`}
                >
                  {quantityWithSymbol(available, asset)}
                </span>
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-loss/10 px-3 py-2 text-[13px] text-loss">{error}</p>
          )}

          <Field label="Дата">
            <input
              type="datetime-local"
              value={dateText}
              max={toInputValue(new Date())}
              onChange={(event) => setDateText(event.target.value)}
              className="num w-full rounded-xl bg-ink-700 px-3 py-2.5 text-fg outline-none"
            />
          </Field>

          <Field label="Борса / портфейл">
            <input
              type="text"
              value={exchange}
              onChange={(event) => setExchange(event.target.value)}
              placeholder="Binance, Ledger, Phantom…"
              className="w-full rounded-xl bg-ink-700 px-3 py-2.5 text-fg outline-none placeholder:text-fg-faint"
            />
            {app.knownExchanges.length > 0 && (
              <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
                {app.knownExchanges.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setExchange(name)}
                    className="shrink-0 rounded-full bg-ink-600/70 px-3 py-1 text-[13px] text-fg-muted"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </Field>

          <Field label="Бележка">
            <input
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="по избор"
              className="w-full rounded-xl bg-ink-700 px-3 py-2.5 text-fg outline-none placeholder:text-fg-faint"
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-fg-muted">{label}</span>
      {children}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  suffix: string;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center rounded-xl bg-ink-700 px-3">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="num w-full bg-transparent py-2.5 text-right text-fg outline-none placeholder:text-fg-faint"
        />
        <span className="num ml-2 shrink-0 text-sm text-fg-faint">{suffix}</span>
      </div>
    </Field>
  );
}

