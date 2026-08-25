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
  ALL_PORTFOLIOS,
  DEFAULT_PORTFOLIOS,
  makePortfolioId,
  type Portfolio,
  type PortfolioSelection,
} from './lib/portfolios';
import { applyTheme } from './lib/themes';
import {
  loadPortfolios,
  loadSettings,
  loadTransactions,
  savePortfolios,
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

  /** Транзакциите на избраното портфолио (или всички при изглед „Общо"). */
  transactions: Transaction[];
  /** Всички транзакции, независимо от избора — за настройки и експорт. */
  allTransactions: Transaction[];
  addTransaction: (tx: Transaction) => Promise<void>;
  updateTransaction: (tx: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  /** Връща броя реално добавени записи. */
  importTransactions: (incoming: Transaction[]) => Promise<number>;
  deleteAllTransactions: () => Promise<void>;

  portfolios: Portfolio[];
  selection: PortfolioSelection;
  setSelection: (selection: PortfolioSelection) => void;
  addPortfolio: (name: string, color: string) => Promise<void>;
  /** Записва портфолиа с вече определени идентификатори — ползва се при импорт. */
  ensurePortfolios: (incoming: Portfolio[]) => Promise<void>;
  updatePortfolio: (portfolio: Portfolio) => Promise<void>;
  /** Изтрива портфолио заедно с транзакциите му. */
  deletePortfolio: (id: string) => Promise<void>;
  /** Колко транзакции има в дадено портфолио. */
  countIn: (id: string) => number;
  /** Портфолиото, в което влиза нова транзакция по подразбиране. */
  defaultPortfolioId: string;

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
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>(DEFAULT_PORTFOLIOS);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [feed, setFeed] = useState<FeedState>(initialFeedState);

  const feedRef = useRef<PriceFeed | null>(null);

  // Първоначално зареждане от IndexedDB.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [storedTransactions, storedSettings, storedPortfolios] = await Promise.all([
        loadTransactions(),
        loadSettings(),
        loadPortfolios(),
      ]);
      if (cancelled) return;

      setAllTransactions(storedTransactions);
      setPortfolios(storedPortfolios);

      // Ако запазеният избор сочи изтрито портфолио, връщаме се на „Общо".
      const selectionExists =
        storedSettings.selection === ALL_PORTFOLIOS ||
        storedPortfolios.some((portfolio) => portfolio.id === storedSettings.selection);

      setSettings(
        selectionExists ? storedSettings : { ...storedSettings, selection: ALL_PORTFOLIOS },
      );
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Темата се слага върху документа при всяка промяна.
  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

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
    setAllTransactions(sorted);
    await saveTransactions(sorted);
  }, []);

  const addTransaction = useCallback(
    async (tx: Transaction) => {
      await persist([...allTransactions, tx]);
    },
    [persist, allTransactions],
  );

  const updateTransaction = useCallback(
    async (tx: Transaction) => {
      await persist(allTransactions.map((item) => (item.id === tx.id ? tx : item)));
    },
    [persist, allTransactions],
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      await persist(allTransactions.filter((item) => item.id !== id));
    },
    [persist, allTransactions],
  );

  const importTransactions = useCallback(
    async (incoming: Transaction[]) => {
      const existing = new Set(allTransactions.map(duplicateKey));
      const fresh = incoming.filter((tx) => !existing.has(duplicateKey(tx)));

      if (fresh.length > 0) await persist([...allTransactions, ...fresh]);
      return fresh.length;
    },
    [persist, allTransactions],
  );

  const deleteAllTransactions = useCallback(async () => {
    await persist([]);
  }, [persist]);

  // -------------------------------------------------------------------------
  // Портфолиа
  // -------------------------------------------------------------------------

  const persistPortfolios = useCallback(async (next: Portfolio[]) => {
    setPortfolios(next);
    await savePortfolios(next);
  }, []);

  const addPortfolio = useCallback(
    async (name: string, color: string) => {
      const created: Portfolio = {
        id: makePortfolioId(name, portfolios),
        name: name.trim(),
        color,
      };
      await persistPortfolios([...portfolios, created]);
    },
    [persistPortfolios, portfolios],
  );

  /**
   * Добавя портфолиа, чиито идентификатори вече са определени от CSV парсера.
   * Не ги преизчислява — иначе транзакциите биха сочили към несъществуващи id.
   */
  const ensurePortfolios = useCallback(
    async (incoming: Portfolio[]) => {
      const missing = incoming.filter(
        (candidate) => !portfolios.some((item) => item.id === candidate.id),
      );
      if (missing.length === 0) return;

      await persistPortfolios([...portfolios, ...missing]);
    },
    [persistPortfolios, portfolios],
  );

  const updatePortfolio = useCallback(
    async (portfolio: Portfolio) => {
      await persistPortfolios(
        portfolios.map((item) => (item.id === portfolio.id ? portfolio : item)),
      );
    },
    [persistPortfolios, portfolios],
  );

  const deletePortfolio = useCallback(
    async (id: string) => {
      // Последното портфолио не се трие — иначе новите транзакции нямат къде
      // да отидат.
      if (portfolios.length <= 1) return;

      const remaining = portfolios.filter((item) => item.id !== id);
      await persistPortfolios(remaining);
      await persist(allTransactions.filter((tx) => tx.portfolioId !== id));

      setSettings((current) => {
        if (current.selection !== id) return current;
        const next: Settings = { ...current, selection: ALL_PORTFOLIOS };
        void saveSettings(next);
        return next;
      });
    },
    [persistPortfolios, persist, portfolios, allTransactions],
  );

  const countIn = useCallback(
    (id: string) => allTransactions.filter((tx) => tx.portfolioId === id).length,
    [allTransactions],
  );

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

  const setSelection = useCallback(
    (selection: PortfolioSelection) => {
      updateSettings({ selection });
    },
    [updateSettings],
  );

  /**
   * Това, което всички екрани виждат: при „Общо" — всичко, иначе само
   * транзакциите на избраното портфолио. Оттук нататък изчисленията не знаят
   * нищо за портфолиата и си остават непроменени.
   */
  const transactions = useMemo(
    () =>
      settings.selection === ALL_PORTFOLIOS
        ? allTransactions
        : allTransactions.filter((tx) => tx.portfolioId === settings.selection),
    [allTransactions, settings.selection],
  );

  /** Нова транзакция влиза в гледаното портфолио; при „Общо" — в първото. */
  const defaultPortfolioId = useMemo(
    () =>
      settings.selection !== ALL_PORTFOLIOS
        ? settings.selection
        : portfolios[0]?.id ?? DEFAULT_PORTFOLIOS[0]!.id,
    [settings.selection, portfolios],
  );

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
      allTransactions.map((tx) => tx.exchange.trim()).filter((name) => name !== ''),
    );
    return [...names].sort((a, b) => a.localeCompare(b, 'bg'));
  }, [allTransactions]);

  const value = useMemo<AppState>(
    () => ({
      ready,
      transactions,
      allTransactions,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      importTransactions,
      deleteAllTransactions,
      portfolios,
      selection: settings.selection,
      setSelection,
      addPortfolio,
      ensurePortfolios,
      updatePortfolio,
      deletePortfolio,
      countIn,
      defaultPortfolioId,
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
      allTransactions,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      importTransactions,
      deleteAllTransactions,
      portfolios,
      setSelection,
      addPortfolio,
      ensurePortfolios,
      updatePortfolio,
      deletePortfolio,
      countIn,
      defaultPortfolioId,
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
