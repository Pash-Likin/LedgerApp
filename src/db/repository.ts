import { DEFAULT_CATEGORIES, FALLBACK_CATEGORY_IDS } from '../constants/categories';
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
import { extractYearMonth, formatLocalDateTime } from '../utils/date';
import { buildDemoTransactionsForMonth } from './demoSeed';
import type { LedgerRepository } from './types';

const CATEGORIES_KEY = 'qingjizhang_categories_v1';
const TRANSACTIONS_KEY = 'qingjizhang_transactions_v1';

function makeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`;
}

const memoryStore = new Map<string, string>();

function readStorage<T>(key: string): T | null {
  try {
    const raw =
      typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem(key)
        : memoryStore.get(key) ?? null;
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeStorage<T>(key: string, value: T): void {
  const raw = JSON.stringify(value);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, raw);
      return;
    }
  } catch {
    // Fallback to in-memory store
  }
  memoryStore.set(key, raw);
}

class WebStorageLedgerRepository implements LedgerRepository {
  private initialized = false;

  private loadCategories(): Category[] {
    const saved = readStorage<Category[]>(CATEGORIES_KEY);
    if (saved && Array.isArray(saved) && saved.length > 0) {
      return saved;
    }
    return [...DEFAULT_CATEGORIES];
  }

  private saveCategories(categories: Category[]): void {
    writeStorage(CATEGORIES_KEY, categories);
  }

  private loadTransactions(): Transaction[] {
    const saved = readStorage<Transaction[]>(TRANSACTIONS_KEY);
    return Array.isArray(saved) ? saved : [];
  }

  private saveTransactions(transactions: Transaction[]): void {
    writeStorage(TRANSACTIONS_KEY, transactions);
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    const existing = readStorage<Category[]>(CATEGORIES_KEY);
    if (!existing || existing.length === 0) {
      this.saveCategories([...DEFAULT_CATEGORIES]);
    }
    const txs = readStorage<Transaction[]>(TRANSACTIONS_KEY);
    if (!txs) {
      this.saveTransactions([]);
    }
    this.initialized = true;
  }

  async getCategories(type?: TransactionType): Promise<Category[]> {
    await this.init();
    const list = this.loadCategories().filter((c) => (type ? c.type === type : true));
    return list.sort((a, b) => {
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      if (a.isFallback !== b.isFallback) return a.isFallback ? 1 : -1;
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.createdAt.localeCompare(b.createdAt);
    });
  }

  async createCategory(input: CreateCategoryInput): Promise<Category> {
    await this.init();
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new Error('分类名称不能为空');
    }
    const categories = this.loadCategories();
    const maxOrder = categories
      .filter((c) => c.type === input.type && !c.isFallback)
      .reduce((max, c) => Math.max(max, c.sortOrder), 0);

    const category: Category = {
      id: makeId('cat'),
      name: trimmedName,
      type: input.type,
      icon: input.icon,
      color: input.color,
      isDefault: false,
      isFallback: false,
      sortOrder: maxOrder + 1,
      createdAt: formatLocalDateTime(),
    };
    categories.push(category);
    this.saveCategories(categories);
    return category;
  }

  async updateCategory(id: string, input: UpdateCategoryInput): Promise<void> {
    await this.init();
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new Error('分类名称不能为空');
    }
    const categories = this.loadCategories().map((c) =>
      c.id === id ? { ...c, name: trimmedName, icon: input.icon, color: input.color } : c
    );
    this.saveCategories(categories);
  }

  async deleteCategory(id: string): Promise<{ reassignedCount: number }> {
    await this.init();
    const categories = this.loadCategories();
    const target = categories.find((c) => c.id === id);
    if (!target) {
      throw new Error('未找到该分类');
    }
    if (target.isFallback) {
      throw new Error('系统保底分类不可删除');
    }

    const fallbackId = FALLBACK_CATEGORY_IDS[target.type];
    const now = formatLocalDateTime();
    let reassignedCount = 0;
    const transactions = this.loadTransactions().map((tx) => {
      if (tx.categoryId === id) {
        reassignedCount += 1;
        return { ...tx, categoryId: fallbackId, updatedAt: now };
      }
      return tx;
    });

    this.saveTransactions(transactions);
    this.saveCategories(categories.filter((c) => c.id !== id));
    return { reassignedCount };
  }

  async getTransactionsByMonth(yearMonth: string): Promise<TransactionWithCategory[]> {
    await this.init();
    const categories = this.loadCategories();
    const catMap = new Map(categories.map((c) => [c.id, c]));

    return this.loadTransactions()
      .filter((tx) => tx.yearMonth === yearMonth)
      .sort(
        (a, b) =>
          b.occurredAt.localeCompare(a.occurredAt) ||
          b.createdAt.localeCompare(a.createdAt)
      )
      .map((tx) => {
        const cat = catMap.get(tx.categoryId);
        return {
          ...tx,
          categoryName:
            cat?.name ?? (tx.type === 'expense' ? '其他支出' : '其他收入'),
          categoryIcon:
            cat?.icon ??
            (tx.type === 'expense'
              ? 'ellipsis-horizontal-circle-outline'
              : 'cash-outline'),
          categoryColor: cat?.color ?? '#64748B',
        };
      });
  }

  async createTransaction(input: CreateTransactionInput): Promise<Transaction> {
    await this.init();
    const now = formatLocalDateTime();
    const tx: Transaction = {
      id: makeId('tx'),
      type: input.type,
      amountCents: Math.round(input.amountCents),
      categoryId: input.categoryId,
      note: input.note.trim(),
      occurredAt: input.occurredAt,
      yearMonth: extractYearMonth(input.occurredAt),
      createdAt: now,
      updatedAt: now,
    };
    const list = this.loadTransactions();
    list.push(tx);
    this.saveTransactions(list);
    return tx;
  }

  async updateTransaction(id: string, input: UpdateTransactionInput): Promise<void> {
    await this.init();
    const now = formatLocalDateTime();
    const list = this.loadTransactions().map((tx) =>
      tx.id === id
        ? {
            ...tx,
            type: input.type,
            amountCents: Math.round(input.amountCents),
            categoryId: input.categoryId,
            note: input.note.trim(),
            occurredAt: input.occurredAt,
            yearMonth: extractYearMonth(input.occurredAt),
            updatedAt: now,
          }
        : tx
    );
    this.saveTransactions(list);
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.init();
    const list = this.loadTransactions().filter((tx) => tx.id !== id);
    this.saveTransactions(list);
  }

  async getAvailableMonths(): Promise<MonthArchiveItem[]> {
    await this.init();
    const map = new Map<string, MonthArchiveItem>();
    for (const tx of this.loadTransactions()) {
      let item = map.get(tx.yearMonth);
      if (!item) {
        item = {
          yearMonth: tx.yearMonth,
          totalExpenseCents: 0,
          totalIncomeCents: 0,
          totalCount: 0,
        };
        map.set(tx.yearMonth, item);
      }
      if (tx.type === 'expense') {
        item.totalExpenseCents += tx.amountCents;
      } else {
        item.totalIncomeCents += tx.amountCents;
      }
      item.totalCount += 1;
    }

    return Array.from(map.values()).sort((a, b) =>
      b.yearMonth.localeCompare(a.yearMonth)
    );
  }

  async seedDemoData(yearMonth: string): Promise<number> {
    await this.init();
    const templates = buildDemoTransactionsForMonth(yearMonth);
    const now = formatLocalDateTime();
    const list = this.loadTransactions();
    for (const item of templates) {
      list.push({
        id: makeId('demo'),
        type: item.type,
        amountCents: item.amountCents,
        categoryId: item.categoryId,
        note: item.note,
        occurredAt: item.occurredAt,
        yearMonth: extractYearMonth(item.occurredAt),
        createdAt: now,
        updatedAt: now,
      });
    }
    this.saveTransactions(list);
    return templates.length;
  }

  async clearAllTransactions(): Promise<void> {
    await this.init();
    this.saveTransactions([]);
  }
}

export const ledgerRepository: LedgerRepository = new WebStorageLedgerRepository();
