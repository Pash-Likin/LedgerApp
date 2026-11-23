import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MonthSwitcher } from '../components/MonthSwitcher';
import { COLORS, RADIUS, SHADOW, SPACING, TABULAR_NUMS } from '../constants/theme';
import { useLedger } from '../context/LedgerContext';
import { showAlert, showConfirm } from '../services/dialog';
import { exportMonthlyCsv, exportMonthlyPdf } from '../services/exportService';
import { triggerSuccessHaptic } from '../services/haptics';
import type { TransactionWithCategory } from '../types/ledger';
import { computeMonthlySummary } from '../utils/analytics';
import { formatYearMonthLabel } from '../utils/date';
import { formatYuan } from '../utils/money';

type ActiveExportJob = {
  month: string;
  format: 'csv' | 'pdf';
} | null;

export function ExportScreen() {
  const {
    selectedMonth,
    setSelectedMonth,
    transactions,
    availableMonths,
    loadTransactionsForMonth,
  } = useLedger();

  const [activeJob, setActiveJob] = useState<ActiveExportJob>(null);

  const summary = useMemo(
    () => computeMonthlySummary(selectedMonth, transactions),
    [selectedMonth, transactions]
  );

  const performExport = async (
    targetMonth: string,
    format: 'csv' | 'pdf',
    targetTransactions: TransactionWithCategory[]
  ) => {
    setActiveJob({ month: targetMonth, format });
    try {
      const result =
        format === 'csv'
          ? await exportMonthlyCsv(targetMonth, targetTransactions)
          : await exportMonthlyPdf(targetMonth, targetTransactions);
      triggerSuccessHaptic();
      if (Platform.OS === 'web') {
        showAlert(
          '导出已触发',
          format === 'csv'
            ? `已下载账单文件：${result.fileName}`
            : `已打开 ${formatYearMonthLabel(targetMonth)} 账单报告预览（可在打印弹窗中选择“另存为 PDF”）`
        );
      }
    } catch (err) {
      showAlert(
        '导出失败',
        err instanceof Error ? err.message : '生成账单文件时发生错误，请重试'
      );
    } finally {
      setActiveJob(null);
    }
  };

  const handleExportMonth = async (targetMonth: string, format: 'csv' | 'pdf') => {
    if (activeJob) return;
    const txs =
      targetMonth === selectedMonth
        ? transactions
        : await loadTransactionsForMonth(targetMonth);

    if (txs.length === 0) {
      showConfirm({
        title: '本月暂无记录',
        message: `${formatYearMonthLabel(targetMonth)} 还没有记账数据，确定要导出空白账单吗？`,
        confirmText: '继续导出',
        onConfirm: () => performExport(targetMonth, format, txs),
      });
      return;
    }

    await performExport(targetMonth, format, txs);
  };

  const isCurrentCsvLoading =
    activeJob?.month === selectedMonth && activeJob.format === 'csv';
  const isCurrentPdfLoading =
    activeJob?.month === selectedMonth && activeJob.format === 'pdf';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>账单导出</Text>
        <MonthSwitcher yearMonth={selectedMonth} onChange={setSelectedMonth} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Monthly Bill Preview Card */}
        <View style={styles.previewCard}>
          <View style={styles.previewHeader}>
            <View style={styles.previewTitleRow}>
              <Ionicons
                name="document-text-outline"
                size={20}
                color={COLORS.primary}
              />
              <Text style={styles.previewTitle}>
                {formatYearMonthLabel(selectedMonth)}账单预览
              </Text>
            </View>
            <View style={styles.previewCountPill}>
              <Text style={styles.previewCountText}>
                {summary.totalCount} 笔记录
              </Text>
            </View>
          </View>

          <View style={styles.kpiRow}>
            <View style={styles.kpiCol}>
              <Text style={styles.kpiLabel}>本月支出</Text>
              <Text style={[styles.kpiValue, { color: COLORS.expense }]}>
                ¥{formatYuan(summary.totalExpenseCents)}
              </Text>
            </View>
            <View style={styles.kpiCol}>
              <Text style={styles.kpiLabel}>本月收入</Text>
              <Text style={[styles.kpiValue, { color: COLORS.income }]}>
                ¥{formatYuan(summary.totalIncomeCents)}
              </Text>
            </View>
            <View style={styles.kpiCol}>
              <Text style={styles.kpiLabel}>月度结余</Text>
              <Text style={[styles.kpiValue, { color: COLORS.primary }]}>
                {summary.netCents < 0 ? '-¥' : '¥'}
                {formatYuan(Math.abs(summary.netCents))}
              </Text>
            </View>
          </View>

          <View style={styles.exportBtns}>
            <TouchableOpacity
              onPress={() => handleExportMonth(selectedMonth, 'csv')}
              disabled={activeJob !== null}
              activeOpacity={0.8}
              style={[
                styles.exportBtn,
                styles.csvBtn,
                activeJob !== null && styles.btnDisabled,
              ]}
            >
              {isCurrentCsvLoading ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Ionicons
                  name="grid-outline"
                  size={20}
                  color={COLORS.white}
                />
              )}
              <View style={styles.exportBtnTextWrap}>
                <Text style={styles.exportBtnTitle}>导出 CSV 账单 (.csv)</Text>
                <Text style={styles.exportBtnSub}>
                  兼容 Excel / WPS 表格，含明细与月度汇总
                </Text>
              </View>
              <Ionicons name="share-outline" size={18} color={COLORS.white} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleExportMonth(selectedMonth, 'pdf')}
              disabled={activeJob !== null}
              activeOpacity={0.8}
              style={[
                styles.exportBtn,
                styles.pdfBtn,
                activeJob !== null && styles.btnDisabled,
              ]}
            >
              {isCurrentPdfLoading ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color={COLORS.white}
                />
              )}
              <View style={styles.exportBtnTextWrap}>
                <Text style={styles.exportBtnTitle}>
                  导出 PDF 月度报告 (.pdf)
                </Text>
                <Text style={styles.exportBtnSub}>
                  A4 排版报告，含分类占比图条与收支明细表
                </Text>
              </View>
              <Ionicons name="share-outline" size={18} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Archive Quick Export List */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>历月账单快速导出</Text>
          {availableMonths.length === 0 ? (
            <View style={styles.emptyArchive}>
              <Text style={styles.emptyArchiveText}>
                还没有任何月份的记账记录，先去记一笔吧
              </Text>
            </View>
          ) : (
            <View style={styles.archiveList}>
              {availableMonths.map((item) => {
                const isCsvBusy =
                  activeJob?.month === item.yearMonth &&
                  activeJob.format === 'csv';
                const isPdfBusy =
                  activeJob?.month === item.yearMonth &&
                  activeJob.format === 'pdf';

                return (
                  <View key={item.yearMonth} style={styles.archiveRow}>
                    <View style={styles.archiveInfo}>
                      <View style={styles.archiveTop}>
                        <Text style={styles.archiveMonth}>
                          {formatYearMonthLabel(item.yearMonth)}
                        </Text>
                        <Text style={styles.archiveCount}>
                          共 {item.totalCount} 笔
                        </Text>
                      </View>
                      <Text style={styles.archiveSums} numberOfLines={1}>
                        支 ¥{formatYuan(item.totalExpenseCents)} · 收 ¥
                        {formatYuan(item.totalIncomeCents)}
                      </Text>
                    </View>

                    <View style={styles.archiveActions}>
                      <TouchableOpacity
                        onPress={() => handleExportMonth(item.yearMonth, 'csv')}
                        disabled={activeJob !== null}
                        style={styles.miniExportChipCsv}
                      >
                        {isCsvBusy ? (
                          <ActivityIndicator
                            size="small"
                            color={COLORS.primary}
                          />
                        ) : (
                          <Text style={styles.miniExportCsvText}>CSV</Text>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleExportMonth(item.yearMonth, 'pdf')}
                        disabled={activeJob !== null}
                        style={styles.miniExportChipPdf}
                      >
                        {isPdfBusy ? (
                          <ActivityIndicator
                            size="small"
                            color={COLORS.expense}
                          />
                        ) : (
                          <Text style={styles.miniExportPdfText}>PDF</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Export Tips Card */}
        <View style={styles.tipCard}>
          <View style={styles.tipTitleRow}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={COLORS.primary}
            />
            <Text style={styles.tipTitle}>导出说明</Text>
          </View>
          <Text style={styles.tipText}>
            • CSV 文件自带 UTF-8 BOM 编码头，在手机或电脑上用 WPS / Microsoft Excel
            直接打开不会出现中文乱码。
          </Text>
          <Text style={styles.tipText}>
            • 安卓设备上点击导出后会呼出系统分享面板，你可以直接保存到本地“文件管理”、发送至微信/QQ、或保存到网盘备份。
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 28,
    gap: SPACING.md,
  },
  previewCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOW.card,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  previewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  previewCountPill: {
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  previewCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    fontVariant: [...TABULAR_NUMS],
  },
  kpiRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  kpiCol: {
    flex: 1,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 15,
    fontWeight: '800',
    fontVariant: [...TABULAR_NUMS],
  },
  exportBtns: {
    gap: SPACING.sm,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  csvBtn: {
    backgroundColor: COLORS.primary,
  },
  pdfBtn: {
    backgroundColor: '#1E293B',
  },
  btnDisabled: {
    opacity: 0.7,
  },
  exportBtnTextWrap: {
    flex: 1,
  },
  exportBtnTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },
  exportBtnSub: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOW.card,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  emptyArchive: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  emptyArchiveText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  archiveList: {
    marginTop: SPACING.xs,
  },
  archiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    gap: SPACING.sm,
  },
  archiveInfo: {
    flex: 1,
  },
  archiveTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  archiveMonth: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    fontVariant: [...TABULAR_NUMS],
  },
  archiveCount: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontVariant: [...TABULAR_NUMS],
  },
  archiveSums: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 3,
    fontVariant: [...TABULAR_NUMS],
  },
  archiveActions: {
    flexDirection: 'row',
    gap: 8,
  },
  miniExportChipCsv: {
    minWidth: 50,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
  },
  miniExportCsvText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  miniExportChipPdf: {
    minWidth: 50,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.expenseSoft,
    alignItems: 'center',
  },
  miniExportPdfText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.expense,
  },
  tipCard: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryTint,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: 6,
  },
  tipTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  tipText: {
    fontSize: 12,
    color: COLORS.primaryDark,
    lineHeight: 18,
  },
});
