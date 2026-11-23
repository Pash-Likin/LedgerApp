import type {
  CategoryBreakdownItem,
  DailyTotalItem,
  DailyTransactionSection,
  MonthlySummary,
  TransactionType,
  TransactionWithCategory,
} from '../types/ledger';
import { extractDateKey, formatDayHeaderLabel, getDaysInMonth, pad2 } from './date';

export function computeMonthlySummary(
  yearMonth: string,
  transactions: TransactionWithCategory[]
): MonthlySummary {
  let totalExpenseCents = 0;
  let totalIncomeCents = 0;
  let expenseCount = 0;
  let incomeCount = 0;

  for (const tx of transactions) {
    if (tx.type === 'expense') {
      totalExpenseCents += tx.amountCents;
      expenseCount += 1;
    } else {
      totalIncomeCents += tx.amountCents;
      incomeCount += 1;
    }
  }

  return {
    yearMonth,
    totalExpenseCents,
    totalIncomeCents,
    netCents: totalIncomeCents - totalExpenseCents,
    expenseCount,
    incomeCount,
    totalCount: expenseCount + incomeCount,
  };
}

export function computeCategoryBreakdown(
  transactions: TransactionWithCategory[],
  type: TransactionType
): CategoryBreakdownItem[] {
  const filtered = transactions.filter((tx) => tx.type === type);
  const totalTypeCents = filtered.reduce((sum, tx) => sum + tx.amountCents, 0);

  const map = new Map<string, Omit<CategoryBreakdownItem, 'percentage'>>();
  for (const tx of filtered) {
    const existing = map.get(tx.categoryId);
    if (existing) {
      existing.totalCents += tx.amountCents;
      existing.count += 1;
    } else {
      map.set(tx.categoryId, {
        categoryId: tx.categoryId,
        categoryName: tx.categoryName,
        categoryIcon: tx.categoryIcon,
        categoryColor: tx.categoryColor,
        type,
        totalCents: tx.amountCents,
        count: 1,
      });
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.totalCents - a.totalCents || b.count - a.count)
    .map((item) => ({
      ...item,
      percentage: totalTypeCents > 0 ? (item.totalCents / totalTypeCents) * 100 : 0,
    }));
}

export function computeDailyTotals(
  yearMonth: string,
  transactions: TransactionWithCategory[]
): DailyTotalItem[] {
  const daysInMonth = getDaysInMonth(yearMonth);
  const items: DailyTotalItem[] = [];
  const indexByDate = new Map<string, DailyTotalItem>();

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${yearMonth}-${pad2(day)}`;
    const entry: DailyTotalItem = {
      day,
      dateKey,
      expenseCents: 0,
      incomeCents: 0,
    };
    items.push(entry);
    indexByDate.set(dateKey, entry);
  }

  for (const tx of transactions) {
    const dateKey = extractDateKey(tx.occurredAt);
    const entry = indexByDate.get(dateKey);
    if (!entry) continue;
    if (tx.type === 'expense') {
      entry.expenseCents += tx.amountCents;
    } else {
      entry.incomeCents += tx.amountCents;
    }
  }

  return items;
}

export function groupTransactionsByDate(
  transactions: TransactionWithCategory[]
): DailyTransactionSection[] {
  const sorted = [...transactions].sort((a, b) =>
    b.occurredAt.localeCompare(a.occurredAt) || b.createdAt.localeCompare(a.createdAt)
  );

  const map = new Map<string, DailyTransactionSection>();
  for (const tx of sorted) {
    const dateKey = extractDateKey(tx.occurredAt);
    let section = map.get(dateKey);
    if (!section) {
      section = {
        dateKey,
        label: formatDayHeaderLabel(dateKey),
        expenseCents: 0,
        incomeCents: 0,
        data: [],
      };
      map.set(dateKey, section);
    }
    section.data.push(tx);
    if (tx.type === 'expense') {
      section.expenseCents += tx.amountCents;
    } else {
      section.incomeCents += tx.amountCents;
    }
  }

  return Array.from(map.values());
}
