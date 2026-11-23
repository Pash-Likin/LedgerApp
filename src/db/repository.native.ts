import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
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

function makeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`;
}

interface RawCategoryRow {
  id: string;
  name: string;
  type: TransactionType;
  icon: string;
  color: string;
  isDefault: number;
  isFallback: number;
  sortOrder: number;
  createdAt: string;
}

function mapCategoryRow(row: RawCategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    icon: row.icon,
    color: row.color,
    isDefault: row.isDefault === 1,
    isFallback: row.isFallback === 1,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
  };
}

class NativeSqliteLedgerRepository implements LedgerRepository {
  private db: SQLiteDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private getDb(): SQLiteDatabase {
    if (!this.db) {
      this.db = openDatabaseSync('qingjizhang.db');
    }
    return this.db;
  }

  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }
    this.initPromise = this.runInit().catch((err) => {
      this.initPromise = null;
      throw err;
    });
    return this.initPromise;
  }

  private async runInit(): Promise<void> {
    const db = this.getDb();
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
        icon TEXT NOT NULL,
        color TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0,
        is_fallback INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 100,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
        amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
        category_id TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        occurred_at TEXT NOT NULL,
        year_month TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (category_id) REFERENCES categories(id)
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_year_month
        ON transactions(year_month, occurred_at DESC);

      CREATE INDEX IF NOT EXISTS idx_transactions_category
        ON transactions(category_id);
    `);

    await db.withTransactionAsync(async () => {
      for (const cat of DEFAULT_CATEGORIES) {
        await db.runAsync(
          `INSERT OR IGNORE INTO categories
            (id, name, type, icon, color, is_default, is_fallback, sort_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            cat.id,
            cat.name,
            cat.type,
            cat.icon,
            cat.color,
            cat.isDefault ? 1 : 0,
            cat.isFallback ? 1 : 0,
            cat.sortOrder,
            cat.createdAt,
          ]
        );
      }
    });
  }

  async getCategories(type?: TransactionType): Promise<Category[]> {
    await this.init();
    const db = this.getDb();
    const sql = type
      ? `SELECT id, name, type, icon, color, is_default AS isDefault, is_fallback AS isFallback, sort_order AS sortOrder, created_at AS createdAt
         FROM categories WHERE type = ? ORDER BY is_fallback ASC, sort_order ASC, created_at ASC`
      : `SELECT id, name, type, icon, color, is_default AS isDefault, is_fallback AS isFallback, sort_order AS sortOrder, created_at AS createdAt
         FROM categories ORDER BY type ASC, is_fallback ASC, sort_order ASC, created_at ASC`;

    const rows = type
      ? await db.getAllAsync<RawCategoryRow>(sql, [type])
      : await db.getAllAsync<RawCategoryRow>(sql);

    return rows.map(mapCategoryRow);
  }

  async createCategory(input: CreateCategoryInput): Promise<Category> {
    await this.init();
    const db = this.getDb();
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new Error('分类名称不能为空');
    }
    const maxOrderRow = await db.getFirstAsync<{ maxOrder: number | null }>(
      `SELECT MAX(sort_order) AS maxOrder FROM categories WHERE type = ? AND is_fallback = 0`,
      [input.type]
    );
    const sortOrder = (maxOrderRow?.maxOrder ?? 0) + 1;
    const category: Category = {
      id: makeId('cat'),
      name: trimmedName,
      type: input.type,
      icon: input.icon,
      color: input.color,
      isDefault: false,
      isFallback: false,
      sortOrder,
      createdAt: formatLocalDateTime(),
    };

    await db.runAsync(
      `INSERT INTO categories
        (id, name, type, icon, color, is_default, is_fallback, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)`,
      [
        category.id,
        category.name,
        category.type,
        category.icon,
        category.color,
        category.sortOrder,
        category.createdAt,
      ]
    );
    return category;
  }

  async updateCategory(id: string, input: UpdateCategoryInput): Promise<void> {
    await this.init();
    const db = this.getDb();
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new Error('分类名称不能为空');
    }
    await db.runAsync(
      `UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ?`,
      [trimmedName, input.icon, input.color, id]
    );
  }

  async deleteCategory(id: string): Promise<{ reassignedCount: number }> {
    await this.init();
    const db = this.getDb();
    let reassignedCount = 0;

    await db.withTransactionAsync(async () => {
      const cat = await db.getFirstAsync<{
        id: string;
        type: TransactionType;
        isFallback: number;
      }>(`SELECT id, type, is_fallback AS isFallback FROM categories WHERE id = ?`, [id]);

      if (!cat) {
        throw new Error('未找到该分类');
      }
      if (cat.isFallback === 1) {
        throw new Error('系统保底分类不可删除');
      }

      const fallbackId = FALLBACK_CATEGORY_IDS[cat.type];
      const countRow = await db.getFirstAsync<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM transactions WHERE category_id = ?`,
        [id]
      );
      reassignedCount = countRow?.cnt ?? 0;

      if (reassignedCount > 0) {
        await db.runAsync(
          `UPDATE transactions SET category_id = ?, updated_at = ? WHERE category_id = ?`,
          [fallbackId, formatLocalDateTime(), id]
        );
      }

      await db.runAsync(`DELETE FROM categories WHERE id = ?`, [id]);
    });

    return { reassignedCount };
  }

  async getTransactionsByMonth(yearMonth: string): Promise<TransactionWithCategory[]> {
    await this.init();
    const db = this.getDb();
    return db.getAllAsync<TransactionWithCategory>(
      `SELECT
        t.id,
        t.type,
        t.amount_cents AS amountCents,
        t.category_id AS categoryId,
        t.note,
        t.occurred_at AS occurredAt,
        t.year_month AS yearMonth,
        t.created_at AS createdAt,
        t.updated_at AS updatedAt,
        COALESCE(c.name, CASE WHEN t.type = 'expense' THEN '其他支出' ELSE '其他收入' END) AS categoryName,
        COALESCE(c.icon, CASE WHEN t.type = 'expense' THEN 'ellipsis-horizontal-circle-outline' ELSE 'cash-outline' END) AS categoryIcon,
        COALESCE(c.color, '#64748B') AS categoryColor
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.year_month = ?
       ORDER BY t.occurred_at DESC, t.created_at DESC`,
      [yearMonth]
    );
  }

  async createTransaction(input: CreateTransactionInput): Promise<Transaction> {
    await this.init();
    const db = this.getDb();
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

    await db.runAsync(
      `INSERT INTO transactions
        (id, type, amount_cents, category_id, note, occurred_at, year_month, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tx.id,
        tx.type,
        tx.amountCents,
        tx.categoryId,
        tx.note,
        tx.occurredAt,
        tx.yearMonth,
        tx.createdAt,
        tx.updatedAt,
      ]
    );

    return tx;
  }

  async updateTransaction(id: string, input: UpdateTransactionInput): Promise<void> {
    await this.init();
    const db = this.getDb();
    const updatedAt = formatLocalDateTime();
    const yearMonth = extractYearMonth(input.occurredAt);
    await db.runAsync(
      `UPDATE transactions
       SET type = ?, amount_cents = ?, category_id = ?, note = ?, occurred_at = ?, year_month = ?, updated_at = ?
       WHERE id = ?`,
      [
        input.type,
        Math.round(input.amountCents),
        input.categoryId,
        input.note.trim(),
        input.occurredAt,
        yearMonth,
        updatedAt,
        id,
      ]
    );
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.init();
    const db = this.getDb();
    await db.runAsync(`DELETE FROM transactions WHERE id = ?`, [id]);
  }

  async getAvailableMonths(): Promise<MonthArchiveItem[]> {
    await this.init();
    const db = this.getDb();
    return db.getAllAsync<MonthArchiveItem>(
      `SELECT
        year_month AS yearMonth,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_cents ELSE 0 END), 0) AS totalExpenseCents,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount_cents ELSE 0 END), 0) AS totalIncomeCents,
        COUNT(*) AS totalCount
       FROM transactions
       GROUP BY year_month
       ORDER BY year_month DESC`
    );
  }

  async seedDemoData(yearMonth: string): Promise<number> {
    await this.init();
    const db = this.getDb();
    const templates = buildDemoTransactionsForMonth(yearMonth);
    const now = formatLocalDateTime();

    await db.withTransactionAsync(async () => {
      for (const item of templates) {
        const id = makeId('demo');
        await db.runAsync(
          `INSERT INTO transactions
            (id, type, amount_cents, category_id, note, occurred_at, year_month, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            item.type,
            item.amountCents,
            item.categoryId,
            item.note,
            item.occurredAt,
            extractYearMonth(item.occurredAt),
            now,
            now,
          ]
        );
      }
    });

    return templates.length;
  }

  async clearAllTransactions(): Promise<void> {
    await this.init();
    const db = this.getDb();
    await db.runAsync(`DELETE FROM transactions`);
  }
}

export const ledgerRepository: LedgerRepository = new NativeSqliteLedgerRepository();
