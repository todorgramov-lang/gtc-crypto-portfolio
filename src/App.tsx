import { useState } from 'react';

import type { AssetId } from './lib/assets';
import type { Transaction } from './lib/types';
import TransactionEditor, { type EditorMode } from './components/TransactionEditor';
import AssetDetail from './screens/AssetDetail';
import Portfolio from './screens/Portfolio';
import Settings from './screens/Settings';
import Transactions from './screens/Transactions';
import { useApp } from './store';

type Tab = 'portfolio' | 'transactions' | 'settings';

const TABS: Array<{ id: Tab; label: string; glyph: string }> = [
  { id: 'portfolio', label: 'Портфолио', glyph: '◐' },
  { id: 'transactions', label: 'Транзакции', glyph: '≡' },
  { id: 'settings', label: 'Настройки', glyph: '⚙' },
];

export default function App() {
  const { ready, deleteTransaction, settings, updateSettings } = useApp();

  const [tab, setTab] = useState<Tab>('portfolio');
  const [openAsset, setOpenAsset] = useState<AssetId | null>(null);
  const [editor, setEditor] = useState<EditorMode | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);

  if (!ready) {
    return (
      <div className="grid h-full place-items-center text-xs text-fg-faint">
        Зареждане…
      </div>
    );
  }

  return (
    <div className="pt-safe flex h-full flex-col">
      <main className="min-h-0 flex-1">
        {openAsset ? (
          <AssetDetail
            asset={openAsset}
            onBack={() => setOpenAsset(null)}
            onAdd={() => setEditor({ kind: 'create', asset: openAsset })}
            onEdit={(transaction) => setEditor({ kind: 'edit', transaction })}
            onDelete={setPendingDelete}
          />
        ) : tab === 'portfolio' ? (
          <Portfolio
            onOpenAsset={setOpenAsset}
            onAddTransaction={() => setEditor({ kind: 'create' })}
          />
        ) : tab === 'transactions' ? (
          <Transactions
            onAdd={() => setEditor({ kind: 'create' })}
            onEdit={(transaction) => setEditor({ kind: 'edit', transaction })}
            onDelete={setPendingDelete}
          />
        ) : (
          <Settings />
        )}
      </main>

      {!openAsset && (
        <nav className="pb-safe shrink-0 border-t border-ink-700 bg-ink-800/95 backdrop-blur">
          <div className="flex">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] transition ${
                  tab === item.id ? 'text-fg' : 'text-fg-faint'
                }`}
              >
                <span className="text-base leading-none" aria-hidden>
                  {item.glyph}
                </span>
                {item.label}
              </button>
            ))}
          </div>
        </nav>
      )}

      {/* Бутон за бързо скриване на сумите — стои над таб лентата. */}
      {!openAsset && tab === 'portfolio' && (
        <button
          type="button"
          onClick={() => updateSettings({ privacyMode: !settings.privacyMode })}
          aria-label={settings.privacyMode ? 'Покажи сумите' : 'Скрий сумите'}
          className="fixed right-4 top-[calc(env(safe-area-inset-top)+0.5rem)] z-20 grid h-9 w-9 place-items-center rounded-full bg-ink-700/80 text-sm backdrop-blur"
        >
          {settings.privacyMode ? '🙈' : '👁'}
        </button>
      )}

      {!openAsset && tab === 'portfolio' && (
        <button
          type="button"
          onClick={() => setEditor({ kind: 'create' })}
          aria-label="Добави транзакция"
          className="fixed left-4 top-[calc(env(safe-area-inset-top)+0.5rem)] z-20 grid h-9 w-9 place-items-center rounded-full bg-ink-700/80 text-lg leading-none backdrop-blur"
        >
          +
        </button>
      )}

      {editor && <TransactionEditor mode={editor} onClose={() => setEditor(null)} />}

      {pendingDelete && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 p-4 backdrop-blur-sm">
          <div className="pb-safe w-full rounded-2xl bg-ink-800 p-4">
            <p className="text-sm font-medium">Да изтрия ли тази транзакция?</p>
            <p className="mt-1 text-xs text-fg-muted">Действието е необратимо.</p>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  void deleteTransaction(pendingDelete.id);
                  setPendingDelete(null);
                }}
                className="flex-1 rounded-xl bg-loss py-2.5 text-xs font-semibold text-white"
              >
                Изтрий
              </button>
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="flex-1 rounded-xl bg-ink-600 py-2.5 text-xs text-fg-muted"
              >
                Отказ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
