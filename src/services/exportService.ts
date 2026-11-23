import type { TransactionWithCategory } from '../types/ledger';
import { buildMonthlyCsv, getExportFileName } from '../utils/csvExport';
import { formatLocalDateTime } from '../utils/date';
import { buildMonthlyReportHtml } from '../utils/pdfExport';

export interface ExportResult {
  fileName: string;
  uri: string;
}

function triggerBrowserDownload(content: string, mimeType: string, fileName: string): string {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    throw new Error('当前环境不支持浏览器文件下载');
  }
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return url;
}

export async function exportMonthlyCsv(
  yearMonth: string,
  transactions: TransactionWithCategory[]
): Promise<ExportResult> {
  const csv = buildMonthlyCsv(yearMonth, transactions);
  const fileName = getExportFileName(yearMonth, 'csv');
  const uri = triggerBrowserDownload(csv, 'text/csv;charset=utf-8;', fileName);
  return { fileName, uri };
}

export async function exportMonthlyPdf(
  yearMonth: string,
  transactions: TransactionWithCategory[]
): Promise<ExportResult> {
  const exportedAtLabel = formatLocalDateTime().replace('T', ' ');
  const html = buildMonthlyReportHtml(yearMonth, transactions, exportedAtLabel);
  const fileName = getExportFileName(yearMonth, 'pdf');

  if (typeof window !== 'undefined') {
    const win = window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => {
        try {
          win.print();
        } catch {
          // Ignore browser print cancellation
        }
      }, 250);
      return { fileName, uri: 'browser://print' };
    }
  }

  const fallbackName = fileName.replace(/\.pdf$/i, '.html');
  const uri = triggerBrowserDownload(html, 'text/html;charset=utf-8;', fallbackName);
  return { fileName: fallbackName, uri };
}
