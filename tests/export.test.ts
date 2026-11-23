import assert from 'node:assert/strict';
import test from 'node:test';
import type { TransactionWithCategory } from '../src/types/ledger';
import { buildMonthlyCsv, escapeCsvCell, getExportFileName } from '../src/utils/csvExport';
import { buildMonthlyReportHtml, escapeHtml } from '../src/utils/pdfExport';

const EXPORT_TXS: TransactionWithCategory[] = [
  {
    id: 'tx_late',
    type: 'expense',
    amountCents: 4550,
    categoryId: 'exp_food',
    note: '晚餐, "火锅"\n加汤',
    occurredAt: '2026-11-12T19:30:00',
    yearMonth: '2026-11',
    createdAt: '2026-11-12T19:30:00',
    updatedAt: '2026-11-12T19:30:00',
    categoryName: '餐饮',
    categoryIcon: 'restaurant-outline',
    categoryColor: '#F97316',
  },
  {
    id: 'tx_early',
    type: 'income',
    amountCents: 800000,
    categoryId: 'inc_salary',
    note: '=SUM(A1:A2)',
    occurredAt: '2026-11-05T09:00:00',
    yearMonth: '2026-11',
    createdAt: '2026-11-05T09:00:00',
    updatedAt: '2026-11-05T09:00:00',
    categoryName: '工资',
    categoryIcon: 'wallet-outline',
    categoryColor: '#059669',
  },
];

test('escapeCsvCell handles quotes, commas, newlines, and formula guards', () => {
  assert.equal(escapeCsvCell('a,b'), '"a,b"');
  assert.equal(escapeCsvCell('say "hi"'), '"say ""hi"""');
  assert.equal(escapeCsvCell('=1+1', { guardFormula: true }), "'=1+1");
  assert.equal(escapeCsvCell('-35.00'), '-35.00');
});

test('getExportFileName produces safe ASCII filenames', () => {
  assert.equal(getExportFileName('2026-11', 'csv'), 'QingJiZhang_2026-11.csv');
  assert.equal(getExportFileName('2026-11', 'pdf'), 'QingJiZhang_2026-11.pdf');
});

test('buildMonthlyCsv outputs UTF-8 BOM, CRLF, chronological rows, and summary', () => {
  const csv = buildMonthlyCsv('2026-11', EXPORT_TXS);
  assert.equal(csv.startsWith('\uFEFF'), true);
  assert.equal(csv.includes('\r\n'), true);

  const withoutBom = csv.slice(1);
  // Early row should appear before late row
  const earlyIndex = withoutBom.indexOf('2026-11-05,09:00,收入,工资,8000.00,\'=SUM(A1:A2)');
  const lateIndex = withoutBom.indexOf('2026-11-12,19:30,支出,餐饮,-45.50,"晚餐, ""火锅""\n加汤"');
  assert.ok(earlyIndex > 0);
  assert.ok(lateIndex > earlyIndex);

  assert.ok(withoutBom.includes('总支出(元),45.50'));
  assert.ok(withoutBom.includes('总收入(元),8000.00'));
  assert.ok(withoutBom.includes('月度结余(元),7954.50'));
  assert.ok(withoutBom.includes('记录笔数,2'));
});

test('buildMonthlyReportHtml escapes unsafe HTML and renders KPIs and breakdown', () => {
  assert.equal(escapeHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');

  const maliciousTx: TransactionWithCategory = {
    ...EXPORT_TXS[0],
    note: '<script>alert(1)</script>',
  };
  const html = buildMonthlyReportHtml('2026-11', [maliciousTx, EXPORT_TXS[1]], '2026-11-23 19:00:00');
  assert.equal(html.includes('<script>alert(1)</script>'), false);
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('2026年11月'));
  assert.ok(html.includes('¥45.50'));
  assert.ok(html.includes('¥8,000.00'));
  assert.ok(html.includes('支出分类构成'));
  assert.ok(html.includes('收入分类构成'));
});

test('buildMonthlyReportHtml handles empty month gracefully', () => {
  const html = buildMonthlyReportHtml('2026-10', [], '2026-11-23 19:00:00');
  assert.ok(html.includes('本月暂无记账明细'));
  assert.ok(html.includes('0 笔'));
});
