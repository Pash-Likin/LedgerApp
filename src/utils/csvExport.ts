import type { TransactionWithCategory } from '../types/ledger';
import { computeMonthlySummary } from './analytics';
import { extractDateKey, extractTimeHHmm } from './date';
import { formatYuan } from './money';

export function escapeCsvCell(
  value: string,
  options?: { guardFormula?: boolean }
): string {
  const guardFormula = options?.guardFormula ?? false;
  let safe = value ?? '';
  if (guardFormula && /^[=+\-@]/.test(safe)) {
    safe = `'${safe}`;
  }
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function getExportFileName(yearMonth: string, ext: 'csv' | 'pdf'): string {
  const safeMonth = yearMonth.replace(/[^0-9-]/g, '');
  return `QingJiZhang_${safeMonth}.${ext}`;
}

export function buildMonthlyCsv(
  yearMonth: string,
  transactions: TransactionWithCategory[]
): string {
  const chronological = [...transactions].sort(
    (a, b) =>
      a.occurredAt.localeCompare(b.occurredAt) ||
      a.createdAt.localeCompare(b.createdAt)
  );

  const lines: string[] = [];
  lines.push('日期,时间,收支类型,分类,金额(元),备注');

  for (const tx of chronological) {
    const dateKey = extractDateKey(tx.occurredAt);
    const time = extractTimeHHmm(tx.occurredAt);
    const typeLabel = tx.type === 'expense' ? '支出' : '收入';
    const signedCents = tx.type === 'expense' ? -tx.amountCents : tx.amountCents;
    const amountStr = formatYuan(signedCents, { withCommas: false });

    const row = [
      escapeCsvCell(dateKey),
      escapeCsvCell(time),
      escapeCsvCell(typeLabel),
      escapeCsvCell(tx.categoryName, { guardFormula: true }),
      escapeCsvCell(amountStr),
      escapeCsvCell(tx.note || '', { guardFormula: true }),
    ].join(',');
    lines.push(row);
  }

  const summary = computeMonthlySummary(yearMonth, chronological);
  lines.push('');
  lines.push(`月度汇总,账期,${escapeCsvCell(yearMonth)}`);
  lines.push(`总支出(元),${formatYuan(summary.totalExpenseCents, { withCommas: false })}`);
  lines.push(`总收入(元),${formatYuan(summary.totalIncomeCents, { withCommas: false })}`);
  lines.push(`月度结余(元),${formatYuan(summary.netCents, { withCommas: false })}`);
  lines.push(`记录笔数,${summary.totalCount}`);

  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
