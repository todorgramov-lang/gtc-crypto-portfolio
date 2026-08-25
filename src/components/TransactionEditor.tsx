import { useMemo, useState, type ReactNode } from 'react';

import { ASSET_IDS, assetInfo, type AssetId } from '../lib/assets';
import { availableQuantity } from '../lib/calc';
import { money, csvNumber } from '../lib/format';
import {
  GOLD_UNITS,
  hasUnitChoice,
  toCanonicalPrice,
  toCanonicalQuantity,
  toDisplayPrice,
  toDisplayQuantity,
  unitLabel,
  unitNameSingular,
  type GoldUnit,
} from '../lib/units';
import { parseUserNumber, ZERO } from '../lib/money';
import { newId } from '../lib/storage';
import { convertAmount } from '../lib/convert';
import {
  isOutflow,
  type DisplayCurrency,
  type Transaction,
  type TxType,
} from '../lib/types';
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
  /**
   * Мярката за въвеждане е на самата сделка. Монетите са в унции,
   * кюлчетата в грамове — и двете се записват в унции.
   * Общата настройка задава само от коя тръгваме.
   */
  const [entryUnit, setEntryUnit] = useState<GoldUnit>(app.settings.goldUnit);
  const goldUnit = entryUnit;

  const [type, setType] = useState<TxType>(editing?.type ?? 'buy');

  // Полетата показват избраната мярка; съхранява се каноничната.
  const [quantityText, setQuantityText] = useState(
    editing
      ? csvNumber(toDisplayQuantity(editing.quantity, editing.asset, goldUnit))
      : '',
  );
  const [priceText, setPriceText] = useState(
    editing
      ? csvNumber(toDisplayPrice(editing.pricePerUnit, editing.asset, goldUnit))
      : '',
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
  /**
   * Валутата, в която е сключена сделката. По подразбиране е тази, която
   * гледаш — купуваш в евро, въвеждаш в евро, вижда се в евро без превод.
   */
  const [currency, setCurrency] = useState<DisplayCurrency>(
    editing?.currency ?? app.settings.currency,
  );
  const [saving, setSaving] = useState(false);

  // Въведеното е в показваната мярка; превръщаме го, преди да го смятаме.
  const quantityInput = parseUserNumber(quantityText);
  const priceInput = parseUserNumber(priceText);

  const quantity = quantityInput
    ? toCanonicalQuantity(quantityInput, asset, goldUnit)
    : null;
  const pricePerUnit = priceInput ? toCanonicalPrice(priceInput, asset, goldUnit) : null;

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

  /**
   * Котировката вече е в показваната валута; ако сделката е в друга,
   * привеждаме я, за да не предлагаме долари срещу еврово поле.
   */
  const marketPrice = useMemo(() => {
    const quoted = app.displayQuotes[asset]?.price;
    if (!quoted) return null;
    return convertAmount(quoted, app.settings.currency, currency, app.eurPerUsd);
  }, [app.displayQuotes, app.settings.currency, app.eurPerUsd, asset, currency]);

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
      return `Нямаш толкова. Разполагаш с ${app.formatter.quantity(available, asset)}.`;
    }
    if (Number.isNaN(Date.parse(dateText))) return 'Въведи валидна дата.';
    return null;
  }, [quantity, pricePerUnit, fee, type, available, asset, dateText, app.formatter]);

  /**
   * Смяна на мярката насред въвеждането. Числата се преизчисляват, за да не
   * останат 50 грама написани, а мярката вече да казва унции.
   */
  function switchUnit(next: GoldUnit) {
    if (next === entryUnit) return;

    if (quantityInput) {
      const canonical = toCanonicalQuantity(quantityInput, asset, entryUnit);
      setQuantityText(csvNumber(toDisplayQuantity(canonical, asset, next)));
    }
    if (priceInput) {
      const canonical = toCanonicalPrice(priceInput, asset, entryUnit);
      setPriceText(csvNumber(toDisplayPrice(canonical, asset, next)));
    }

    setEntryUnit(next);
  }

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
      currency,
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

      {/*
        Височината е ограничена така, че панелът никога да не стига до лентата
        с часа и сигнала — оттам идваше застъпването.
      */}
      <div className="flex max-h-[calc(100dvh-env(safe-area-inset-top)-2.5rem)] flex-col rounded-t-3xl border-t border-ink-600 bg-ink-800">
        <header className="shrink-0 border-b border-ink-700 px-4 pb-3 pt-2.5">
          <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-ink-500" aria-hidden />
          <h2 className="text-center text-base font-semibold">
            {editing ? 'Редакция' : 'Нова транзакция'}
          </h2>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
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
            <div className="grid grid-cols-3 gap-1.5">
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
                  {id === 'XAU' ? 'Злато' : id}
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

          <Field label="Валута на сделката">
            <div className="grid grid-cols-2 gap-1.5">
              {(['EUR', 'USD'] as DisplayCurrency[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCurrency(value)}
                  className={`rounded-xl py-2 text-sm font-medium transition ${
                    currency === value ? 'bg-fg text-ink-900' : 'bg-ink-700 text-fg-muted'
                  }`}
                >
                  {value === 'EUR' ? '€ Евро' : '$ Долари'}
                </button>
              ))}
            </div>
            {currency !== app.settings.currency && (
              <p className="mt-1.5 px-1 text-xs text-fg-faint">
                Сделката се записва в {currency === 'EUR' ? 'евро' : 'долари'} и се
                превръща по днешния курс, докато гледаш в{' '}
                {app.settings.currency === 'EUR' ? 'евро' : 'долари'}.
              </p>
            )}
          </Field>

          {hasUnitChoice(asset) && (
            <Field label="Мярка на тази сделка">
              <div className="grid grid-cols-2 gap-1.5">
                {GOLD_UNITS.map((unit) => (
                  <button
                    key={unit.id}
                    type="button"
                    onClick={() => switchUnit(unit.id)}
                    className={`rounded-xl py-2 text-sm font-medium transition ${
                      entryUnit === unit.id ? 'bg-fg text-ink-900' : 'bg-ink-700 text-fg-muted'
                    }`}
                  >
                    {unit.name}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 px-1 text-xs text-fg-faint">
                Монетите обикновено са в унции, кюлчетата в грамове. И двете се
                записват в унции, затова се събират без грешка.
              </p>
            </Field>
          )}

          <NumberField
            label="Количество"
            value={quantityText}
            onChange={setQuantityText}
            placeholder={asset === 'XAU' ? '0.000' : '0.00000000'}
            suffix={unitLabel(asset, goldUnit)}
          />

          <div>
            <NumberField
              label={`Цена за ${unitNameSingular(asset, goldUnit)}`}
              value={priceText}
              onChange={setPriceText}
              placeholder="0.00"
              {...{ suffix: currency }}
            />
            {marketPrice && (
              <button
                type="button"
                onClick={() =>
                  setPriceText(
                    csvNumber(
                      toDisplayPrice(marketPrice, asset, goldUnit).toDecimalPlaces(
                        assetInfo(asset).priceDecimals,
                      ),
                    ),
                  )
                }
                className="mt-1.5 flex w-full items-center justify-between rounded-lg bg-ink-700/60 px-3 py-2 text-[13px] text-fg-muted"
              >
                <span>Използвай текущата цена</span>
                <span className="num">
                  {money(
                    toDisplayPrice(marketPrice, asset, goldUnit),
                    currency,
                    assetInfo(asset).priceDecimals,
                  )}
                </span>
              </button>
            )}
          </div>

          <NumberField
            label="Такса"
            value={feeText}
            onChange={setFeeText}
            placeholder="0.00"
            {...{ suffix: currency }}
          />

          <div className="rounded-xl bg-ink-700/50 px-3 py-2.5">
            {/* Грамовете влизат в наличността като унции — показваме колко. */}
            {hasUnitChoice(asset) && entryUnit === 'g' && quantity && (
              <div className="mb-1.5 flex items-center justify-between border-b border-ink-600/60 pb-1.5">
                <span className="text-[13px] text-fg-faint">В наличността</span>
                <span className="num text-[13px] text-fg-muted">
                  {csvNumber(quantity.toDecimalPlaces(6))} oz
                </span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-sm text-fg-muted">Обща стойност</span>
              <span className="num text-base font-semibold">{money(total, currency)}</span>
            </div>

            {isOutflow(type) && (
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[13px] text-fg-faint">Налично</span>
                <span
                  className={`num text-[13px] ${available.gt(0) ? 'text-fg-muted' : 'text-loss'}`}
                >
                  {app.formatter.quantity(available, asset)}
                </span>
              </div>
            )}
          </div>

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

        {/*
          Действията стоят долу, до палеца, и не се скролват заедно със
          съдържанието. Причината за грешката е точно над тях — там гледаш,
          когато „Запази" е неактивен.
        */}
        <footer className="pb-safe shrink-0 border-t border-ink-700 bg-ink-800 px-4 pt-3">
          {error && (
            <p className="mb-3 rounded-lg bg-loss/10 px-3 py-2 text-[13px] text-loss">
              {error}
            </p>
          )}

          <div className="flex gap-3 pb-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl bg-ink-600 py-3.5 text-base font-medium text-fg-muted transition active:scale-[0.98]"
            >
              Отказ
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={error !== null || saving}
              className="flex-[1.6] rounded-xl bg-profit py-3.5 text-base font-semibold text-white transition active:scale-[0.98] disabled:bg-ink-600 disabled:text-fg-faint"
            >
              {saving ? 'Записване…' : 'Запази'}
            </button>
          </div>
        </footer>
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

