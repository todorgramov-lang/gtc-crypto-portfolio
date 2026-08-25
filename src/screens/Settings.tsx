import { useRef, useState, type ReactNode } from 'react';

import { downloadCsv, exportCsv, parseCsv } from '../lib/csv';
import { money } from '../lib/format';
import type { CostBasisMethod, DisplayCurrency } from '../lib/types';
import { useApp } from '../store';

export default function Settings() {
  const {
    settings,
    updateSettings,
    transactions,
    importTransactions,
    deleteAllTransactions,
    eurPerUsd,
  } = useApp();

  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function handleExport() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`crypto-portfolio-${stamp}.csv`, exportCsv(transactions));
    setMessage('Файлът е свален.');
  }

  async function handleImportFile(file: File) {
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      const added = await importTransactions(parsed.transactions);

      setMessage(
        `Импортирани: ${added}. Пропуснати редове: ${parsed.skippedLines.length}.`,
      );
    } catch {
      setMessage('Файлът не можа да бъде прочетен.');
    }
  }

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <header className="sticky top-0 z-10 border-b border-ink-700 bg-ink-900/95 px-4 py-2.5 backdrop-blur">
        <h1 className="text-sm font-semibold">Настройки</h1>
      </header>

      <div className="space-y-5 px-4 py-4">
        <Group title="Показване">
          <Segmented<DisplayCurrency>
            label="Валута"
            value={settings.currency}
            options={[
              { value: 'EUR', label: '€ EUR' },
              { value: 'USD', label: '$ USD' },
            ]}
            onChange={(currency) => updateSettings({ currency })}
          />

          <p className="px-1 pb-1 text-[10px] leading-relaxed text-fg-faint">
            Изчисленията се водят в USD и се конвертират при показване. Текущ курс:
            1 USD = <span className="num">{money(eurPerUsd, 'EUR', 4)}</span>.
          </p>

          <Toggle
            label="Скрий сумите"
            hint="Заменя парите с ●●●● — процентите остават видими."
            checked={settings.privacyMode}
            onChange={(privacyMode) => updateSettings({ privacyMode })}
          />

          <Toggle
            label="Пулсиране при промяна на цена"
            hint="Кратък зелен или червен проблясък."
            checked={settings.priceFlash}
            onChange={(priceFlash) => updateSettings({ priceFlash })}
          />
        </Group>

        <Group title="Изчисления">
          <Segmented<CostBasisMethod>
            label="Метод на себестойност"
            value={settings.costBasis}
            options={[
              { value: 'average', label: 'Средна цена' },
              { value: 'fifo', label: 'FIFO' },
            ]}
            onChange={(costBasis) => updateSettings({ costBasis })}
          />

          <p className="px-1 pb-1 text-[10px] leading-relaxed text-fg-faint">
            Методът влияе върху средната цена, инвестираната сума и реализираната
            печалба/загуба.
          </p>
        </Group>

        <Group title="Данни">
          <Row onClick={handleExport} disabled={transactions.length === 0}>
            Експорт на CSV
          </Row>

          <Row onClick={() => fileInput.current?.click()}>Импорт на CSV</Row>

          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImportFile(file);
              event.target.value = '';
            }}
          />

          {confirmingDelete ? (
            <div className="rounded-xl bg-loss/10 p-3">
              <p className="text-[11px] text-loss">
                Това ще изтрие всички {transactions.length} транзакции безвъзвратно.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void deleteAllTransactions();
                    setConfirmingDelete(false);
                    setMessage('Всички транзакции са изтрити.');
                  }}
                  className="rounded-lg bg-loss px-3 py-1.5 text-[11px] font-semibold text-white"
                >
                  Да, изтрий
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="rounded-lg bg-ink-600 px-3 py-1.5 text-[11px] text-fg-muted"
                >
                  Отказ
                </button>
              </div>
            </div>
          ) : (
            <Row
              onClick={() => setConfirmingDelete(true)}
              disabled={transactions.length === 0}
              tone="loss"
            >
              Изтрий всички транзакции
            </Row>
          )}

          <p className="px-1 text-[10px] leading-relaxed text-fg-faint">
            Колони: date, asset, type, quantity, price, fee, exchange, note.
          </p>
        </Group>

        <Group title="Информация">
          <Info label="Брой транзакции" value={String(transactions.length)} />
          <Info label="Версия" value={__BUILD_STAMP__} />
          <p className="px-1 pt-1 text-[10px] leading-relaxed text-fg-faint">
            Приложението не дава инвестиционни съвети, прогнози или сигнали. Данните
            остават на устройството — нищо не се изпраща навън освен заявките за цени
            към Binance, Hyperliquid и CoinGecko.
          </p>
        </Group>
      </div>

      {message && (
        <div className="fixed inset-x-4 bottom-24 z-50 rounded-xl bg-ink-600 px-4 py-3 text-center text-xs shadow-lg">
          {message}
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="ml-3 text-fg-faint"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-fg-faint">
        {title}
      </h2>
      <div className="space-y-2 rounded-2xl border border-ink-600/60 bg-ink-800/60 p-3">
        {children}
      </div>
    </section>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (next: T) => void;
}) {
  return (
    <div>
      <span className="mb-1.5 block px-1 text-[11px] text-fg-muted">{label}</span>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-ink-700/60 p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-lg py-1.5 text-[11px] font-medium transition ${
              value === option.value ? 'bg-ink-500 text-fg' : 'text-fg-muted'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-xl px-1 py-1.5 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-xs">{label}</span>
        {hint && <span className="block text-[10px] text-fg-faint">{hint}</span>}
      </span>

      <span
        className={`relative h-6 w-10 shrink-0 rounded-full transition ${
          checked ? 'bg-profit' : 'bg-ink-500'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
            checked ? 'left-[1.125rem]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  );
}

function Row({
  children,
  onClick,
  disabled = false,
  tone,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'loss';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-xl px-1 py-2 text-left text-xs transition disabled:opacity-40 ${
        tone === 'loss' ? 'text-loss' : ''
      }`}
    >
      {children}
    </button>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-1 py-1.5">
      <span className="text-xs text-fg-muted">{label}</span>
      <span className="num text-xs">{value}</span>
    </div>
  );
}
