import { useRef, useState, type ReactNode } from 'react';

import { downloadCsv, exportCsv, parseCsv } from '../lib/csv';
import { money } from '../lib/format';
import { PORTFOLIO_COLORS, nextColor, type Portfolio } from '../lib/portfolios';
import { THEMES } from '../lib/themes';
import type { CostBasisMethod, DisplayCurrency } from '../lib/types';
import { useApp } from '../store';

export default function Settings() {
  const {
    settings,
    updateSettings,
    allTransactions,
    importTransactions,
    deleteAllTransactions,
    eurPerUsd,
    portfolios,
    addPortfolio,
    ensurePortfolios,
    updatePortfolio,
    deletePortfolio,
    countIn,
    defaultPortfolioId,
  } = useApp();

  const [editingPortfolio, setEditingPortfolio] = useState<Portfolio | null>(null);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [confirmingPortfolioDelete, setConfirmingPortfolioDelete] = useState<string | null>(
    null,
  );

  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function handleExport() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`crypto-portfolio-${stamp}.csv`, exportCsv(allTransactions, portfolios));
    setMessage('Файлът е свален.');
  }

  async function handleImportFile(file: File) {
    try {
      const text = await file.text();
      const parsed = parseCsv(text, portfolios, defaultPortfolioId);

      // Портфолиа, срещнати във файла, но липсващи тук, се създават сами —
      // иначе редовете им щяха да се загубят. Записват се с идентификаторите,
      // които парсерът вече е дал на транзакциите.
      await ensurePortfolios(parsed.newPortfolios);

      const added = await importTransactions(parsed.transactions);

      const extra =
        parsed.newPortfolios.length > 0
          ? ` Нови портфолиа: ${parsed.newPortfolios.map((p) => p.name).join(', ')}.`
          : '';

      setMessage(
        `Импортирани: ${added}. Пропуснати редове: ${parsed.skippedLines.length}.${extra}`,
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

        <Group title="Тема">
          <div className="grid grid-cols-2 gap-2">
            {THEMES.map((theme) => {
              const active = settings.theme === theme.id;

              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => updateSettings({ theme: theme.id })}
                  className={`flex items-center gap-2 rounded-xl border p-2.5 text-left transition ${
                    active ? 'border-fg' : 'border-ink-600'
                  }`}
                >
                  <span className="flex shrink-0 overflow-hidden rounded-md">
                    {theme.swatch.map((color) => (
                      <span
                        key={color}
                        className="h-6 w-2.5"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </span>
                  <span className="text-xs font-medium">{theme.name}</span>
                  {active && <span className="ml-auto text-[11px] text-profit">✓</span>}
                </button>
              );
            })}
          </div>
        </Group>

        <Group title="Портфолиа">
          {portfolios.map((portfolio) => {
            const count = countIn(portfolio.id);
            const isEditing = editingPortfolio?.id === portfolio.id;
            const isConfirming = confirmingPortfolioDelete === portfolio.id;

            if (isConfirming) {
              return (
                <div key={portfolio.id} className="rounded-xl bg-loss/10 p-3">
                  <p className="text-[11px] text-loss">
                    Изтриването на „{portfolio.name}" ще махне и{' '}
                    {count === 1 ? 'неговата 1 транзакция' : `неговите ${count} транзакции`}.
                    Няма връщане назад.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void deletePortfolio(portfolio.id);
                        setConfirmingPortfolioDelete(null);
                        setMessage(`Портфолио „${portfolio.name}" е изтрито.`);
                      }}
                      className="rounded-lg bg-loss px-3 py-1.5 text-[11px] font-semibold text-white"
                    >
                      Да, изтрий
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingPortfolioDelete(null)}
                      className="rounded-lg bg-ink-600 px-3 py-1.5 text-[11px] text-fg-muted"
                    >
                      Отказ
                    </button>
                  </div>
                </div>
              );
            }

            if (isEditing) {
              return (
                <div key={portfolio.id} className="rounded-xl bg-ink-700/50 p-3">
                  <input
                    type="text"
                    value={editingPortfolio.name}
                    onChange={(event) =>
                      setEditingPortfolio({ ...editingPortfolio, name: event.target.value })
                    }
                    className="w-full rounded-lg bg-ink-800 px-3 py-2 text-fg outline-none"
                    placeholder="Име"
                  />

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {PORTFOLIO_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={`Цвят ${color}`}
                        onClick={() => setEditingPortfolio({ ...editingPortfolio, color })}
                        className={`h-7 w-7 rounded-full transition ${
                          editingPortfolio.color === color
                            ? 'ring-2 ring-fg ring-offset-2 ring-offset-ink-700'
                            : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const name = editingPortfolio.name.trim();
                        if (name === '') return;
                        void updatePortfolio({ ...editingPortfolio, name });
                        setEditingPortfolio(null);
                      }}
                      className="rounded-lg bg-fg px-3 py-1.5 text-[11px] font-semibold text-ink-900"
                    >
                      Запази
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingPortfolio(null)}
                      className="rounded-lg bg-ink-600 px-3 py-1.5 text-[11px] text-fg-muted"
                    >
                      Отказ
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={portfolio.id} className="flex items-center gap-2.5 px-1 py-1.5">
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-full"
                  style={{ backgroundColor: portfolio.color }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs">{portfolio.name}</span>
                  <span className="num block text-[10px] text-fg-faint">
                    {count === 1 ? '1 транзакция' : `${count} транзакции`}
                  </span>
                </span>

                <button
                  type="button"
                  onClick={() => setEditingPortfolio(portfolio)}
                  className="rounded-lg px-2 py-1 text-[11px] text-fg-muted"
                >
                  Промени
                </button>

                {portfolios.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setConfirmingPortfolioDelete(portfolio.id)}
                    aria-label={`Изтрий ${portfolio.name}`}
                    className="rounded-lg px-2 py-1 text-[11px] text-fg-faint"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}

          <div className="flex gap-2 border-t border-ink-700 pt-3">
            <input
              type="text"
              value={newPortfolioName}
              onChange={(event) => setNewPortfolioName(event.target.value)}
              placeholder="Ново портфолио"
              className="min-w-0 flex-1 rounded-xl bg-ink-700 px-3 py-2 text-fg outline-none placeholder:text-fg-faint"
            />
            <button
              type="button"
              disabled={newPortfolioName.trim() === ''}
              onClick={() => {
                void addPortfolio(newPortfolioName.trim(), nextColor(portfolios));
                setNewPortfolioName('');
              }}
              className="shrink-0 rounded-xl bg-fg px-3.5 text-xs font-semibold text-ink-900 disabled:opacity-40"
            >
              Добави
            </button>
          </div>

          <p className="px-1 text-[10px] leading-relaxed text-fg-faint">
            Всяка транзакция принадлежи на едно портфолио. От началния екран
            превключваш кое гледаш, а „Общо" сумира всички.
          </p>
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
          <Row onClick={handleExport} disabled={allTransactions.length === 0}>
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
                Това ще изтрие всички {allTransactions.length} транзакции безвъзвратно.
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
              disabled={allTransactions.length === 0}
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
          <Info label="Брой транзакции" value={String(allTransactions.length)} />
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
