import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { computeSummary } from './lib/calc';
import { makeFormatter, type Formatter } from './lib/format';
import { dec, type Decimal } from './lib/money';
import { FALLBACK_EUR_PER_USD, PriceFeed, type FeedState } from './lib/prices';
import { duplicateKey } from './lib/csv';
import {
  loadSettings,
  loadTransactions,
  saveSettings,
  saveTransactions,
} from './lib/storage';
import {
  DEFAULT_SETTINGS,
  type PortfolioSummary,
  type Settings,
  type Transaction,
} from './lib/types';

interface AppState {
  ready: boolean;

  transactions: Transaction[];
  addTransaction: (tx: Transaction) => Promise<void>;
  updateTransaction: (tx: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  /** Връща броя реално добавени записи. */
  importTransactions: (incoming: Transaction[]) => Promise<number>;
  deleteAllTransactions: () => Promise<void>;

  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;

  feed: FeedState;
  refresh: () => Promise<void>;

  summary: PortfolioSummary;
  formatter: Formatter;
  eurPerUsd: Decimal;

  /** Борсите, въведени досега — за бързи предложения. */
  knownExchanges: string[];
}

const AppContext = createContext<AppState | null>(null);

const initialFeedState: FeedState = {
  quotes: {},
  status: 'offline',
  lastUpdate: null,
  fromCache: false,
  eurPerUsd: dec(FALLBACK_EUR_PER_USD),
  errorMessage: null,
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [feed, setFeed] = useState<FeedState>(initialFeedState);

  const feedRef = useRef<PriceFeed | null>(null);

  // Първоначално зареждане от IndexedDB.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [storedTransactions, storedSettings] = await Promise.all([
        loadTransactions(),
        loadSettings(),
      ]);
      if (cancelled) return;

      setTransactions(storedTransactions);
      setSettings(storedSettings);
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Живите цени.
  useEffect(() => {
    const priceFeed = new PriceFeed();
    feedRef.current = priceFeed;

    const unsubscribe = priceFeed.subscribe(setFeed);
    void priceFeed.start();

    /**
     * Когато приложението е скрито (заключен телефон, друг таб), затваряме
     * потоците — иначе батерията се топи без никой да гледа. При връщане
     * се вдигат отново и веднага се дърпа пресен REST update.
     */
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') priceFeed.stop();
      else void priceFeed.start();
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      unsubscribe();
      priceFeed.stop();
      feedRef.current = null;
    };
  }, []);

  const persist = useCallback(async (next: Transaction[]) => {
    const sorted = [...next].sort((a, b) => b.date.getTime() - a.date.getTime());
    setTransactions(sorted);
    await saveTransactions(sorted);
  }, []);

  const addTransaction = useCallback(
    async (tx: Transaction) => {
      await persist([...transactions, tx]);
    },
    [persist, transactions],
  );

  const updateTransaction = useCallback(
    async (tx: Transaction) => {
      await persist(transactions.map((item) => (item.id === tx.id ? tx : item)));
    },
    [persist, transactions],
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      await persist(transactions.filter((item) => item.id !== id));
    },
    [persist, transactions],
  );

  const importTransactions = useCallback(
    async (incoming: Transaction[]) => {
      const existing = new Set(transactions.map(duplicateKey));
      const fresh = incoming.filter((tx) => !existing.has(duplicateKey(tx)));

      if (fresh.length > 0) await persist([...transactions, ...fresh]);
      return fresh.length;
    },
    [persist, transactions],
  );

  const deleteAllTransactions = useCallback(async () => {
    await persist([]);
  }, [persist]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      void saveSettings(next);
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    await feedRef.current?.refreshNow();
  }, []);

  const summary = useMemo(
    () => computeSummary(transactions, feed.quotes, settings.costBasis),
    [transactions, feed.quotes, settings.costBasis],
  );

  const formatter = useMemo(
    () => makeFormatter(settings.currency, feed.eurPerUsd, settings.privacyMode),
    [settings.currency, settings.privacyMode, feed.eurPerUsd],
  );

  const knownExchanges = useMemo(() => {
    const names = new Set(
      transactions.map((tx) => tx.exchange.trim()).filter((name) => name !== ''),
    );
    return [...names].sort((a, b) => a.localeCompare(b, 'bg'));
  }, [transactions]);

  const value = useMemo<AppState>(
    () => ({
      ready,
      transactions,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      importTransactions,
      deleteAllTransactions,
      settings,
      updateSettings,
      feed,
      refresh,
      summary,
      formatter,
      eurPerUsd: feed.eurPerUsd,
      knownExchanges,
    }),
    [
      ready,
      transactions,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      importTransactions,
      deleteAllTransactions,
      settings,
      updateSettings,
      feed,
      refresh,
      summary,
      formatter,
      knownExchanges,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp трябва да е вътре в <AppProvider>.');
  return context;
}
