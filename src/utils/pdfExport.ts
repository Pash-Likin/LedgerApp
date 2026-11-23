import type { CategoryBreakdownItem, TransactionWithCategory } from '../types/ledger';
import { computeCategoryBreakdown, computeMonthlySummary } from './analytics';
import { extractDateKey, extractTimeHHmm, formatYearMonthLabel } from './date';
import { formatSignedYuan, formatYuan } from './money';

export function escapeHtml(value: string): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderBreakdownSection(title: string, items: CategoryBreakdownItem[]): string {
  if (items.length === 0) {
    return '';
  }
  const rows = items
    .map((item) => {
      const pct = Math.min(100, Math.max(0, item.percentage));
      const pctLabel = pct.toFixed(1);
      return `
        <div class="cat-row">
          <div class="cat-label">
            <span class="cat-dot" style="background:${escapeHtml(item.categoryColor)}"></span>
            <span class="cat-name">${escapeHtml(item.categoryName)}</span>
            <span class="cat-count">${item.count} 笔</span>
          </div>
          <div class="cat-bar-track">
            <div class="cat-bar-fill" style="width:${pct.toFixed(2)}%;background:${escapeHtml(item.categoryColor)}"></div>
          </div>
          <div class="cat-val">
            <strong>¥${formatYuan(item.totalCents)}</strong>
            <span>${pctLabel}%</span>
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <section class="section">
      <h2>${escapeHtml(title)}</h2>
      <div class="breakdown-list">${rows}</div>
    </section>
  `;
}

export function buildMonthlyReportHtml(
  yearMonth: string,
  transactions: TransactionWithCategory[],
  exportedAtLabel: string
): string {
  const chronological = [...transactions].sort(
    (a, b) =>
      a.occurredAt.localeCompare(b.occurredAt) ||
      a.createdAt.localeCompare(b.createdAt)
  );
  const summary = computeMonthlySummary(yearMonth, chronological);
  const expenseBreakdown = computeCategoryBreakdown(chronological, 'expense');
  const incomeBreakdown = computeCategoryBreakdown(chronological, 'income');
  const monthLabel = formatYearMonthLabel(yearMonth);

  const ledgerRows =
    chronological.length > 0
      ? chronological
          .map((tx) => {
            const dateStr = `${extractDateKey(tx.occurredAt)} ${extractTimeHHmm(tx.occurredAt)}`;
            const isExpense = tx.type === 'expense';
            const typeText = isExpense ? '支出' : '收入';
            const amountText = formatSignedYuan(tx.amountCents, tx.type);
            const noteText = tx.note.trim() ? escapeHtml(tx.note.trim()) : '<span class="muted">—</span>';
            return `
              <tr>
                <td class="num">${escapeHtml(dateStr)}</td>
                <td><span class="badge ${isExpense ? 'badge-exp' : 'badge-inc'}">${typeText}</span></td>
                <td>
                  <span class="cat-pill">
                    <span class="cat-dot-sm" style="background:${escapeHtml(tx.categoryColor)}"></span>
                    ${escapeHtml(tx.categoryName)}
                  </span>
                </td>
                <td>${noteText}</td>
                <td class="num amount ${isExpense ? 'exp' : 'inc'}">${escapeHtml(amountText)}</td>
              </tr>
            `;
          })
          .join('')
      : `
        <tr>
          <td colspan="5" class="empty-cell">本月暂无记账明细</td>
        </tr>
      `;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>轻记账 · ${escapeHtml(monthLabel)}账单报告</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
      color: #0F172A;
      background: #FFFFFF;
      font-size: 12px;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-bottom: 14px;
      border-bottom: 2px solid #0F766E;
      margin-bottom: 18px;
    }
    .title {
      font-size: 20px;
      font-weight: 700;
      color: #0F172A;
      margin: 0 0 4px 0;
    }
    .subtitle {
      font-size: 12px;
      color: #64748B;
      margin: 0;
    }
    .period-badge {
      background: #F0FDFA;
      color: #0F766E;
      border: 1px solid #CCFBF1;
      padding: 6px 12px;
      border-radius: 999px;
      font-weight: 700;
      font-size: 13px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 20px;
    }
    .kpi-card {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      padding: 10px 12px;
    }
    .kpi-label {
      font-size: 11px;
      color: #64748B;
      margin-bottom: 4px;
    }
    .kpi-value {
      font-size: 16px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .exp { color: #E11D48; }
    .inc { color: #059669; }
    .net { color: #0F766E; }
    .section {
      margin-bottom: 18px;
    }
    h2 {
      font-size: 14px;
      font-weight: 700;
      color: #0F172A;
      margin: 0 0 10px 0;
      padding-left: 8px;
      border-left: 3px solid #0F766E;
    }
    .breakdown-list {
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      padding: 10px 12px;
    }
    .cat-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 0;
      border-bottom: 1px solid #F1F5F9;
    }
    .cat-row:last-child { border-bottom: none; }
    .cat-label {
      width: 145px;
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .cat-dot {
      width: 9px;
      height: 9px;
      border-radius: 999px;
      display: inline-block;
      flex-shrink: 0;
    }
    .cat-dot-sm {
      width: 7px;
      height: 7px;
      border-radius: 999px;
      display: inline-block;
    }
    .cat-name { font-weight: 600; }
    .cat-count { color: #94A3B8; font-size: 11px; }
    .cat-bar-track {
      flex: 1;
      height: 8px;
      background: #F1F5F9;
      border-radius: 999px;
      overflow: hidden;
    }
    .cat-bar-fill {
      height: 100%;
      border-radius: 999px;
    }
    .cat-val {
      width: 120px;
      text-align: right;
      font-variant-numeric: tabular-nums;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      flex-shrink: 0;
    }
    .cat-val span { color: #64748B; font-size: 11px; width: 42px; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11.5px;
    }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    th {
      text-align: left;
      background: #F8FAFC;
      color: #475569;
      font-weight: 600;
      padding: 8px 10px;
      border-top: 1px solid #E2E8F0;
      border-bottom: 1px solid #CBD5E1;
    }
    th.amount, td.amount { text-align: right; }
    td {
      padding: 7px 10px;
      border-bottom: 1px solid #F1F5F9;
      vertical-align: middle;
    }
    .num { font-variant-numeric: tabular-nums; }
    .badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 999px;
      font-size: 10.5px;
      font-weight: 600;
    }
    .badge-exp { background: #FFF1F2; color: #E11D48; }
    .badge-inc { background: #ECFDF5; color: #059669; }
    .cat-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-weight: 500;
    }
    .muted { color: #94A3B8; }
    .empty-cell {
      text-align: center;
      color: #64748B;
      padding: 24px 12px;
    }
    .footer {
      margin-top: 18px;
      text-align: right;
      font-size: 10.5px;
      color: #94A3B8;
    }
  </style>
</head>
<body>
  <header class="header">
    <div>
      <h1 class="title">轻记账 · 月度账单报告</h1>
      <p class="subtitle">导出时间：${escapeHtml(exportedAtLabel)}</p>
    </div>
    <div class="period-badge">${escapeHtml(monthLabel)}</div>
  </header>

  <section class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">本月总支出</div>
      <div class="kpi-value exp">¥${formatYuan(summary.totalExpenseCents)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">本月总收入</div>
      <div class="kpi-value inc">¥${formatYuan(summary.totalIncomeCents)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">本月结余</div>
      <div class="kpi-value net">${summary.netCents < 0 ? '-¥' : '¥'}${formatYuan(Math.abs(summary.netCents))}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">记账笔数</div>
      <div class="kpi-value">${summary.totalCount} 笔</div>
    </div>
  </section>

  ${renderBreakdownSection('支出分类构成', expenseBreakdown)}
  ${renderBreakdownSection('收入分类构成', incomeBreakdown)}

  <section class="section">
    <h2>账单明细（按时间顺序）</h2>
    <table>
      <thead>
        <tr>
          <th style="width:130px">日期时间</th>
          <th style="width:62px">类型</th>
          <th style="width:105px">分类</th>
          <th>备注</th>
          <th class="amount" style="width:110px">金额</th>
        </tr>
      </thead>
      <tbody>
        ${ledgerRows}
      </tbody>
    </table>
  </section>

  <footer class="footer">由 轻记账 App 生成 · 数据仅保存在本地设备</footer>
</body>
</html>`;
}
