import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { TransactionWithCategory } from '../types/ledger';
import { buildMonthlyCsv, getExportFileName } from '../utils/csvExport';
import { formatLocalDateTime, formatYearMonthLabel } from '../utils/date';
import { buildMonthlyReportHtml } from '../utils/pdfExport';

export interface ExportResult {
  fileName: string;
  uri: string;
}

export async function exportMonthlyCsv(
  yearMonth: string,
  transactions: TransactionWithCategory[]
): Promise<ExportResult> {
  const csv = buildMonthlyCsv(yearMonth, transactions);
  const fileName = getExportFileName(yearMonth, 'csv');
  const file = new File(Paths.cache, fileName);

  if (file.exists) {
    file.delete();
  }
  file.create({ overwrite: true });
  await file.write(csv, { encoding: 'utf8' });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('当前设备不支持系统分享导出功能');
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: `导出 ${formatYearMonthLabel(yearMonth)} CSV 账单`,
  });

  return { fileName, uri: file.uri };
}

export async function exportMonthlyPdf(
  yearMonth: string,
  transactions: TransactionWithCategory[]
): Promise<ExportResult> {
  const exportedAtLabel = formatLocalDateTime().replace('T', ' ');
  const html = buildMonthlyReportHtml(yearMonth, transactions, exportedAtLabel);
  const fileName = getExportFileName(yearMonth, 'pdf');

  const { uri: tempUri } = await Print.printToFileAsync({ html });

  let shareUri = tempUri;
  try {
    const sourceFile = new File(tempUri);
    const targetFile = new File(Paths.cache, fileName);
    if (targetFile.exists) {
      targetFile.delete();
    }
    await sourceFile.copy(targetFile, { overwrite: true });
    shareUri = targetFile.uri;
  } catch {
    shareUri = tempUri;
  }

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('当前设备不支持系统分享导出功能');
  }

  await Sharing.shareAsync(shareUri, {
    mimeType: 'application/pdf',
    dialogTitle: `导出 ${formatYearMonthLabel(yearMonth)} PDF 月度报告`,
  });

  return { fileName, uri: shareUri };
}
