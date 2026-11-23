import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { FALLBACK_CATEGORY_IDS } from '../constants/categories';
import { ledgerRepository } from '../db/repository';
import { autoLedger, type CapturedRecord } from '../services/autoLedger';
import type {
  Category,
  CreateCategoryInput,
  CreateTransactionInput,
  MonthArchiveItem,
  TransactionWithCategory,
  UpdateCategoryInput,
  UpdateTransactionInput,
} from '../types/ledger';
import { computeMonthlySummary } from '../utils/analytics';
import { formatYearMonthLabel, getCurrentYearMonth } from '../utils/date';
import { formatYuan } from '../utils/money';

interface LedgerContextValue {
  isInitializing: boolean;
  initError: string | null;
  isLoadingMonth: boolean;
  selectedMonth: string;
  setSelectedMonth: (yearMonth: string) => void;
  categories: Category[];
  transactions: TransactionWithCategory[];
  availableMonths: MonthArchiveItem[];
  pendingCaptures: CapturedRecord[];
  addTransaction: (input: CreateTransactionInput) => Promise<void>;
  updateTransaction: (id: string, input: UpdateTransactionInput) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addCategory: (input: CreateCategoryInput) => Promise<Category>;
  updateCategory: (id: string, input: UpdateCategoryInput) => Promise<void>;
  deleteCategory: (id: string) => Promise<{ reassignedCount: number }>;
  loadTransactionsForMonth: (yearMonth: string) => Promise<TransactionWithCategory[]>;
  seedDemoData: (yearMonth?: string) => Promise<number>;
  clearAllTransactions: () => Promise<void>;
  refreshAll: () => Promise<void>;
  syncAutoCaptures: () => Promise<CapturedRecord[]>;
  confirmPendingCapture: (
    captureId: string,
    input: CreateTransactionInput
  ) => Promise<void>;
  ignorePendingCapture: (captureId: string) => Promise<void>;
  syncWidgetSnapshot: () => Promise<void>;
}

const LedgerContext = createContext<LedgerContextValue | null>(null);

export function LedgerProvider({ children }: { children: React.ReactNode }) {
  const [selectedMonth, setSelectedMonthState] = useState<string>(() =>
    getCurrentYearMonth()
  );
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [isLoadingMonth, setIsLoadingMonth] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
  const [availableMonths, setAvailableMonths] = useState<MonthArchiveItem[]>([]);
  const [pendingCaptures, setPendingCaptures] = useState<CapturedRecord[]>([]);

  const selectedMonthRef = useRef(selectedMonth);
  selectedMonthRef.current = selectedMonth;
  const syncInFlightRef = useRef(false);

  const pushWidgetSnapshot = useCallback(
    async (
      currentMonthTxs?: TransactionWithCategory[],
      currentMonthKey?: string
    ) => {
      const activeCurrentMonth = currentMonthKey ?? getCurrentYearMonth();
      const txs =
        currentMonthTxs ??
        (await ledgerRepository.getTransactionsByMonth(activeCurrentMonth));
      const summary = computeMonthlySummary(activeCurrentMonth, txs);
      const latest = txs[0];
      const latestSummary = latest
        ? `最近：${latest.categoryName} ${
            latest.type === 'expense' ? '-' : '+'
          }¥${formatYuan(latest.amountCents)}`
        : '本月暂无记录 · 点右上角记一笔';

      autoLedger.updateWidgetData({
        monthLabel: formatYearMonthLabel(activeCurrentMonth),
        totalExpenseCents: summary.totalExpenseCents,
        totalIncomeCents: summary.totalIncomeCents,
        netCents: summary.netCents,
        latestSummary,
      });
    },
    []
  );

  const reloadState = useCallback(
    async (targetMonth: string) => {
      const [cats, txs, months] = await Promise.all([
        ledgerRepository.getCategories(),
        ledgerRepository.getTransactionsByMonth(targetMonth),
        ledgerRepository.getAvailableMonths(),
      ]);
      setCategories(cats);
      setTransactions(txs);
      setAvailableMonths(months);

      const currentMonth = getCurrentYearMonth();
      if (targetMonth === currentMonth) {
        await pushWidgetSnapshot(txs, currentMonth);
      } else {
        await pushWidgetSnapshot(undefined, currentMonth);
      }
      return cats;
    },
    [pushWidgetSnapshot]
  );

  const syncAutoCaptures = useCallback(
    async (knownCategories?: Category[]): Promise<CapturedRecord[]> => {
      if (syncInFlightRef.current) {
        const currentPending = autoLedger
          .getCaptures()
          .filter((c) => c.status === 'pending');
        setPendingCaptures(currentPending);
        return currentPending;
      }

      syncInFlightRef.current = true;
      try {
        const allCaptures = autoLedger.getCaptures();
        const confirmed = allCaptures.filter((c) => c.status === 'confirmed');
        const pending = allCaptures.filter((c) => c.status === 'pending');

        if (confirmed.length > 0) {
          const cats =
            knownCategories && knownCategories.length > 0
              ? knownCategories
              : await ledgerRepository.getCategories();
          const catIds = new Set(cats.map((c) => c.id));
          const committedIds: string[] = [];

          for (const item of confirmed) {
            const categoryId = catIds.has(item.suggestedCategoryId)
              ? item.suggestedCategoryId
              : FALLBACK_CATEGORY_IDS[item.type];
            const noteText = item.merchant
              ? `${item.merchant}（${item.sourceApp}自动记账）`
              : `${item.sourceApp}自动记账`;
            await ledgerRepository.createTransaction({
              type: item.type,
              amountCents: item.amountCents,
              categoryId,
              note: noteText,
              occurredAt: item.occurredAt,
            });
            committedIds.push(item.id);
          }

          autoLedger.clearConfirmedCaptures(committedIds);
          await reloadState(selectedMonthRef.current);
        }

        setPendingCaptures(pending);
        return pending;
      } finally {
        syncInFlightRef.current = false;
      }
    },
    [reloadState]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setIsInitializing(true);
        setInitError(null);
        await ledgerRepository.init();
        if (!active) return;
        const cats = await reloadState(selectedMonthRef.current);
        if (!active) return;
        await syncAutoCaptures(cats);
      } catch (err) {
        if (!active) return;
        setInitError(
          err instanceof Error ? err.message : '初始化本地账本失败，请重启应用重试'
        );
      } finally {
        if (active) {
          setIsInitializing(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [reloadState, syncAutoCaptures]);

  useEffect(() => {
    const unsubCaptures = autoLedger.subscribeCapturesChanged(() => {
      syncAutoCaptures().catch(() => {});
    });

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncAutoCaptures().catch(() => {});
      }
    });

    return () => {
      unsubCaptures();
      appStateSub.remove();
    };
  }, [syncAutoCaptures]);

  const setSelectedMonth = useCallback((yearMonth: string) => {
    setSelectedMonthState(yearMonth);
    setIsLoadingMonth(true);
    ledgerRepository
      .getTransactionsByMonth(yearMonth)
      .then((txs) => setTransactions(txs))
      .catch(() => {})
      .finally(() => setIsLoadingMonth(false));
  }, []);

  const refreshAll = useCallback(async () => {
    setIsLoadingMonth(true);
    try {
      const cats = await reloadState(selectedMonthRef.current);
      await syncAutoCaptures(cats);
    } finally {
      setIsLoadingMonth(false);
    }
  }, [reloadState, syncAutoCaptures]);

  const addTransaction = useCallback(
    async (input: CreateTransactionInput) => {
      await ledgerRepository.createTransaction(input);
      await reloadState(selectedMonthRef.current);
    },
    [reloadState]
  );

  const updateTransaction = useCallback(
    async (id: string, input: UpdateTransactionInput) => {
      await ledgerRepository.updateTransaction(id, input);
      await reloadState(selectedMonthRef.current);
    },
    [reloadState]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      await ledgerRepository.deleteTransaction(id);
      await reloadState(selectedMonthRef.current);
    },
    [reloadState]
  );

  const addCategory = useCallback(
    async (input: CreateCategoryInput) => {
      const created = await ledgerRepository.createCategory(input);
      await reloadState(selectedMonthRef.current);
      return created;
    },
    [reloadState]
  );

  const updateCategory = useCallback(
    async (id: string, input: UpdateCategoryInput) => {
      await ledgerRepository.updateCategory(id, input);
      await reloadState(selectedMonthRef.current);
    },
    [reloadState]
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      const result = await ledgerRepository.deleteCategory(id);
      await reloadState(selectedMonthRef.current);
      return result;
    },
    [reloadState]
  );

  const loadTransactionsForMonth = useCallback(
    (yearMonth: string) => ledgerRepository.getTransactionsByMonth(yearMonth),
    []
  );

  const seedDemoData = useCallback(
    async (yearMonth?: string) => {
      const count = await ledgerRepository.seedDemoData(
        yearMonth ?? selectedMonthRef.current
      );
      await reloadState(selectedMonthRef.current);
      return count;
    },
    [reloadState]
  );

  const clearAllTransactions = useCallback(async () => {
    await ledgerRepository.clearAllTransactions();
    await reloadState(selectedMonthRef.current);
  }, [reloadState]);

  const confirmPendingCapture = useCallback(
    async (captureId: string, input: CreateTransactionInput) => {
      await ledgerRepository.createTransaction(input);
      autoLedger.removeCapture(captureId);
      setPendingCaptures((prev) => prev.filter((c) => c.id !== captureId));
      await reloadState(selectedMonthRef.current);
    },
    [reloadState]
  );

  const ignorePendingCapture = useCallback(async (captureId: string) => {
    autoLedger.removeCapture(captureId);
    setPendingCaptures((prev) => prev.filter((c) => c.id !== captureId));
    await pushWidgetSnapshot();
  }, [pushWidgetSnapshot]);

  const syncWidgetSnapshot = useCallback(async () => {
    await pushWidgetSnapshot();
  }, [pushWidgetSnapshot]);

  return (
    <LedgerContext.Provider
      value={{
        isInitializing,
        initError,
        isLoadingMonth,
        selectedMonth,
        setSelectedMonth,
        categories,
        transactions,
        availableMonths,
        pendingCaptures,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        addCategory,
        updateCategory,
        deleteCategory,
        loadTransactionsForMonth,
        seedDemoData,
        clearAllTransactions,
        refreshAll,
        syncAutoCaptures: () => syncAutoCaptures(),
        confirmPendingCapture,
        ignorePendingCapture,
        syncWidgetSnapshot,
      }}
    >
      {children}
    </LedgerContext.Provider>
  );
}

export function useLedger(): LedgerContextValue {
  const ctx = useContext(LedgerContext);
  if (!ctx) {
    throw new Error('useLedger must be used inside LedgerProvider');
  }
  return ctx;
}
