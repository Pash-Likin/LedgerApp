import assert from 'node:assert/strict';
import test from 'node:test';
import type { TransactionWithCategory } from '../src/types/ledger';
import {
  computeCategoryBreakdown,
  computeDailyTotals,
  computeMonthlySummary,
  groupTransactionsByDate,
} from '../src/utils/analytics';

const SAMPLE_TXS: TransactionWithCategory[] = [
  {
    id: '1',
    type: 'expense',
    amountCents: 3500,
    categoryId: 'exp_food',
    note: '午餐',
    occurredAt: '2026-11-23T12:10:00',
    yearMonth: '2026-11',
    createdAt: '2026-11-23T12:10:00',
    updatedAt: '2026-11-23T12:10:00',
    categoryName: '餐饮',
    categoryIcon: 'restaurant-outline',
    categoryColor: '#F97316',
  },
  {
    id: '2',
    type: 'expense',
    amountCents: 6500,
    categoryId: 'exp_food',
    note: '晚餐',
    occurredAt: '2026-11-23T19:00:00',
    yearMonth: '2026-11',
    createdAt: '2026-11-23T19:00:00',
    updatedAt: '2026-11-23T19:00:00',
    categoryName: '餐饮',
    categoryIcon: 'restaurant-outline',
    categoryColor: '#F97316',
  },
  {
    id: '3',
    type: 'expense',
    amountCents: 30000,
    categoryId: 'exp_shopping',
    note: '外套',
    occurredAt: '2026-11-20T15:30:00',
    yearMonth: '2026-11',
    createdAt: '2026-11-20T15:30:00',
    updatedAt: '2026-11-20T15:30:00',
    categoryName: '购物',
    categoryIcon: 'bag-handle-outline',
    categoryColor: '#EC4899',
  },
  {
    id: '4',
    type: 'income',
    amountCents: 100000,
    categoryId: 'inc_salary',
    note: '工资',
    occurredAt: '2026-11-05T09:00:00',
    yearMonth: '2026-11',
    createdAt: '2026-11-05T09:00:00',
    updatedAt: '2026-11-05T09:00:00',
    categoryName: '工资',
    categoryIcon: 'wallet-outline',
    categoryColor: '#059669',
  },
];

test('computeMonthlySummary aggregates totals and net balance accurately', () => {
  const summary = computeMonthlySummary('2026-11', SAMPLE_TXS);
  assert.equal(summary.totalExpenseCents, 40000);
  assert.equal(summary.totalIncomeCents, 100000);
  assert.equal(summary.netCents, 60000);
  assert.equal(summary.expenseCount, 3);
  assert.equal(summary.incomeCount, 1);
  assert.equal(summary.totalCount, 4);
});

test('computeCategoryBreakdown sorts descending and calculates exact percentages', () => {
  const breakdown = computeCategoryBreakdown(SAMPLE_TXS, 'expense');
  assert.equal(breakdown.length, 2);
  assert.equal(breakdown[0].categoryId, 'exp_shopping');
  assert.equal(breakdown[0].totalCents, 30000);
  assert.equal(breakdown[0].percentage, 75);
  assert.equal(breakdown[1].categoryId, 'exp_food');
  assert.equal(breakdown[1].totalCents, 10000);
  assert.equal(breakdown[1].count, 2);
  assert.equal(breakdown[1].percentage, 25);
});

test('computeDailyTotals generates one entry per day of month', () => {
  const daily = computeDailyTotals('2026-11', SAMPLE_TXS);
  assert.equal(daily.length, 30);
  assert.equal(daily[4].incomeCents, 100000); // Nov 5
  assert.equal(daily[19].expenseCents, 30000); // Nov 20
  assert.equal(daily[22].expenseCents, 10000); // Nov 23
});

test('groupTransactionsByDate groups in descending date order with subtotals', () => {
  const sections = groupTransactionsByDate(SAMPLE_TXS);
  assert.equal(sections.length, 3);
  assert.equal(sections[0].dateKey, '2026-11-23');
  assert.equal(sections[0].expenseCents, 10000);
  assert.equal(sections[0].data[0].id, '2');
  assert.equal(sections[1].dateKey, '2026-11-20');
  assert.equal(sections[2].dateKey, '2026-11-05');
  assert.equal(sections[2].incomeCents, 100000);
});
