export type TransactionType = 'expense' | 'income';

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  icon: string;
  color: string;
  isDefault: boolean;
  isFallback: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  /** Positive integer amount in fen (1 yuan = 100 cents). */
  amountCents: number;
  categoryId: string;
  note: string;
  /** Local timestamp in 'YYYY-MM-DDTHH:mm:ss' format (never UTC). */
  occurredAt: string;
  /** Month partition key in 'YYYY-MM' format. */
  yearMonth: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionWithCategory extends Transaction {
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
}

export interface MonthlySummary {
  yearMonth: string;
  totalExpenseCents: number;
  totalIncomeCents: number;
  netCents: number;
  expenseCount: number;
  incomeCount: number;
  totalCount: number;
}

export interface CategoryBreakdownItem {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  type: TransactionType;
  totalCents: number;
  count: number;
  percentage: number;
}

export interface DailyTotalItem {
  day: number;
  dateKey: string;
  expenseCents: number;
  incomeCents: number;
}

export interface MonthArchiveItem {
  yearMonth: string;
  totalExpenseCents: number;
  totalIncomeCents: number;
  totalCount: number;
}

export interface DailyTransactionSection {
  dateKey: string;
  label: string;
  expenseCents: number;
  incomeCents: number;
  data: TransactionWithCategory[];
}

export interface CreateTransactionInput {
  type: TransactionType;
  amountCents: number;
  categoryId: string;
  note: string;
  occurredAt: string;
}

export interface UpdateTransactionInput {
  type: TransactionType;
  amountCents: number;
  categoryId: string;
  note: string;
  occurredAt: string;
}

export interface CreateCategoryInput {
  name: string;
  type: TransactionType;
  icon: string;
  color: string;
}

export interface UpdateCategoryInput {
  name: string;
  icon: string;
  color: string;
}
