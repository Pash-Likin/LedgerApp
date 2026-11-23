import type {
  Category,
  CreateCategoryInput,
  CreateTransactionInput,
  MonthArchiveItem,
  Transaction,
  TransactionType,
  TransactionWithCategory,
  UpdateCategoryInput,
  UpdateTransactionInput,
} from '../types/ledger';

export interface LedgerRepository {
  init(): Promise<void>;
  getCategories(type?: TransactionType): Promise<Category[]>;
  createCategory(input: CreateCategoryInput): Promise<Category>;
  updateCategory(id: string, input: UpdateCategoryInput): Promise<void>;
  deleteCategory(id: string): Promise<{ reassignedCount: number }>;
  getTransactionsByMonth(yearMonth: string): Promise<TransactionWithCategory[]>;
  createTransaction(input: CreateTransactionInput): Promise<Transaction>;
  updateTransaction(id: string, input: UpdateTransactionInput): Promise<void>;
  deleteTransaction(id: string): Promise<void>;
  getAvailableMonths(): Promise<MonthArchiveItem[]>;
  seedDemoData(yearMonth: string): Promise<number>;
  clearAllTransactions(): Promise<void>;
}
