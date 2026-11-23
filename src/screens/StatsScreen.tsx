import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { DailyBarChart } from '../components/DailyBarChart';
import { DonutChart } from '../components/DonutChart';
import { MonthSwitcher } from '../components/MonthSwitcher';
import { COLORS, RADIUS, SHADOW, SPACING, TABULAR_NUMS } from '../constants/theme';
import { useLedger } from '../context/LedgerContext';
import { triggerSelectionHaptic } from '../services/haptics';
import type { TransactionType, TransactionWithCategory } from '../types/ledger';
import {
  computeCategoryBreakdown,
  computeDailyTotals,
  computeMonthlySummary,
} from '../utils/analytics';
import { extractDateKey, extractTimeHHmm, getDaysInMonth } from '../utils/date';
import { formatYuan } from '../utils/money';

interface StatsScreenProps {
  onEditTransaction: (tx: TransactionWithCategory) => void;
}

export function StatsScreen({ onEditTransaction }: StatsScreenProps) {
  const { selectedMonth, setSelectedMonth, transactions } = useLedger();
  const [statType, setStatType] = useState<TransactionType>('expense');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  );

  const summary = useMemo(
    () => computeMonthlySummary(selectedMonth, transactions),
    [selectedMonth, transactions]
  );

  const breakdown = useMemo(
    () => computeCategoryBreakdown(transactions, statType),
    [transactions, statType]
  );

  const dailyTotals = useMemo(
    () => computeDailyTotals(selectedMonth, transactions),
    [selectedMonth, transactions]
  );

  const activeTotalCents =
    statType === 'expense'
      ? summary.totalExpenseCents
      : summary.totalIncomeCents;

  const daysCount = getDaysInMonth(selectedMonth);
  const dailyAverageCents = Math.round(activeTotalCents / Math.max(1, daysCount));
  const peakDayCents = useMemo(
    () =>
      dailyTotals.reduce(
        (max, d) =>
          Math.max(max, statType === 'expense' ? d.expenseCents : d.incomeCents),
        0
      ),
    [dailyTotals, statType]
  );

  const handleToggleType = (next: TransactionType) => {
    if (next === statType) return;
    triggerSelectionHaptic();
    setStatType(next);
    setSelectedCategoryId(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>收支统计</Text>
        <MonthSwitcher yearMonth={selectedMonth} onChange={setSelectedMonth} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Type Segmented Switch */}
        <View style={styles.typeSegmented}>
          <TouchableOpacity
            onPress={() => handleToggleType('expense')}
            style={[
              styles.typeTab,
              statType === 'expense' && styles.typeTabExpense,
            ]}
          >
            <Text
              style={[
                styles.typeTabText,
                statType === 'expense' && styles.typeTabTextActive,
              ]}
            >
              支出分析 · ¥{formatYuan(summary.totalExpenseCents)}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleToggleType('income')}
            style={[
              styles.typeTab,
              statType === 'income' && styles.typeTabIncome,
            ]}
          >
            <Text
              style={[
                styles.typeTabText,
                statType === 'income' && styles.typeTabTextActive,
              ]}
            >
              收入分析 · ¥{formatYuan(summary.totalIncomeCents)}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Donut Chart Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              {statType === 'expense' ? '支出分类占比' : '收入分类占比'}
            </Text>
            {selectedCategoryId ? (
              <TouchableOpacity
                onPress={() => setSelectedCategoryId(null)}
                hitSlop={8}
              >
                <Text style={styles.resetLink}>查看全部</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.donutWrap}>
            <DonutChart
              items={breakdown}
              totalCents={activeTotalCents}
              centerTitle={statType === 'expense' ? '本月支出' : '本月收入'}
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={(id) => {
                triggerSelectionHaptic();
                setSelectedCategoryId(id);
              }}
            />
          </View>

          {breakdown.length > 0 ? (
            <View style={styles.legendGrid}>
              {breakdown.slice(0, 6).map((item) => {
                const isSelected = selectedCategoryId === item.categoryId;
                return (
                  <TouchableOpacity
                    key={item.categoryId}
                    onPress={() => {
                      triggerSelectionHaptic();
                      setSelectedCategoryId(
                        isSelected ? null : item.categoryId
                      );
                    }}
                    style={[
                      styles.legendChip,
                      isSelected && {
                        backgroundColor: `${item.categoryColor}1A`,
                        borderColor: item.categoryColor,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.legendDot,
                        { backgroundColor: item.categoryColor },
                      ]}
                    />
                    <Text style={styles.legendName} numberOfLines={1}>
                      {item.categoryName}
                    </Text>
                    <Text style={styles.legendPct}>
                      {item.percentage.toFixed(1)}%
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
        </View>

        {/* Daily Bar Chart Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              {statType === 'expense' ? '每日支出趋势' : '每日收入分布'}
            </Text>
            <View style={styles.miniMetrics}>
              <Text style={styles.miniMetricText}>
                日均 ¥{formatYuan(dailyAverageCents)}
              </Text>
              <Text style={styles.miniMetricSep}>·</Text>
              <Text style={styles.miniMetricText}>
                单日最高 ¥{formatYuan(peakDayCents)}
              </Text>
            </View>
          </View>

          <DailyBarChart items={dailyTotals} type={statType} />
        </View>

        {/* Category Breakdown Ranking */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {statType === 'expense' ? '支出分类排行' : '收入分类排行'}
          </Text>

          {breakdown.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                本月暂无{statType === 'expense' ? '支出' : '收入'}数据
              </Text>
            </View>
          ) : (
            <View style={styles.rankList}>
              {breakdown.map((item) => {
                const isExpanded = selectedCategoryId === item.categoryId;
                const categoryTxs = isExpanded
                  ? transactions.filter(
                      (t) =>
                        t.type === statType && t.categoryId === item.categoryId
                    )
                  : [];

                return (
                  <View key={item.categoryId} style={styles.rankItemWrap}>
                    <TouchableOpacity
                      onPress={() => {
                        triggerSelectionHaptic();
                        setSelectedCategoryId(
                          isExpanded ? null : item.categoryId
                        );
                      }}
                      activeOpacity={0.75}
                      style={[
                        styles.rankRow,
                        isExpanded && styles.rankRowExpanded,
                      ]}
                    >
                      <View
                        style={[
                          styles.rankIconBadge,
                          { backgroundColor: `${item.categoryColor}1A` },
                        ]}
                      >
                        <Ionicons
                          name={
                            item.categoryIcon as keyof typeof Ionicons.glyphMap
                          }
                          size={19}
                          color={item.categoryColor}
                        />
                      </View>

                      <View style={styles.rankMiddle}>
                        <View style={styles.rankTopLine}>
                          <Text style={styles.rankName}>
                            {item.categoryName}
                          </Text>
                          <Text style={styles.rankCount}>
                            {item.count} 笔 · {item.percentage.toFixed(1)}%
                          </Text>
                        </View>
                        <View style={styles.progressTrack}>
                          <View
                            style={[
                              styles.progressFill,
                              {
                                width: `${Math.min(100, Math.max(2, item.percentage))}%`,
                                backgroundColor: item.categoryColor,
                              },
                            ]}
                          />
                        </View>
                      </View>

                      <View style={styles.rankRight}>
                        <Text style={styles.rankAmount}>
                          ¥{formatYuan(item.totalCents)}
                        </Text>
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={14}
                          color={COLORS.textMuted}
                        />
                      </View>
                    </TouchableOpacity>

                    {isExpanded ? (
                      <View style={styles.inlineTxList}>
                        {categoryTxs.map((tx) => (
                          <TouchableOpacity
                            key={tx.id}
                            onPress={() => onEditTransaction(tx)}
                            style={styles.inlineTxRow}
                            activeOpacity={0.7}
                          >
                            <View style={styles.inlineTxLeft}>
                              <Text style={styles.inlineTxDate}>
                                {extractDateKey(tx.occurredAt).slice(5)}{' '}
                                {extractTimeHHmm(tx.occurredAt)}
                              </Text>
                              <Text
                                style={styles.inlineTxNote}
                                numberOfLines={1}
                              >
                                {tx.note.trim() || '无备注'}
                              </Text>
                            </View>
                            <Text style={styles.inlineTxAmount}>
                              ¥{formatYuan(tx.amountCents)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
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
  typeSegmented: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  typeTabExpense: {
    backgroundColor: COLORS.expense,
  },
  typeTabIncome: {
    backgroundColor: COLORS.income,
  },
  typeTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    fontVariant: [...TABULAR_NUMS],
  },
  typeTabTextActive: {
    color: COLORS.white,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOW.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    flexWrap: 'wrap',
    gap: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  resetLink: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  donutWrap: {
    paddingVertical: SPACING.xs,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: SPACING.md,
  },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: RADIUS.pill,
  },
  legendName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
    maxWidth: 72,
  },
  legendPct: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    fontVariant: [...TABULAR_NUMS],
  },
  miniMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniMetricText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    fontVariant: [...TABULAR_NUMS],
  },
  miniMetricSep: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  emptyBox: {
    paddingVertical: SPACING.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  rankList: {
    marginTop: SPACING.sm,
    gap: 8,
  },
  rankItemWrap: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: RADIUS.md,
  },
  rankRowExpanded: {
    backgroundColor: COLORS.surfaceAlt,
  },
  rankIconBadge: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankMiddle: {
    flex: 1,
  },
  rankTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  rankName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  rankCount: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontVariant: [...TABULAR_NUMS],
  },
  progressTrack: {
    height: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.divider,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: RADIUS.pill,
  },
  rankRight: {
    alignItems: 'flex-end',
    gap: 2,
    minWidth: 74,
  },
  rankAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
    fontVariant: [...TABULAR_NUMS],
  },
  inlineTxList: {
    backgroundColor: COLORS.surfaceAlt,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
  },
  inlineTxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  inlineTxLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: SPACING.sm,
  },
  inlineTxDate: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontVariant: [...TABULAR_NUMS],
  },
  inlineTxNote: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  inlineTxAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    fontVariant: [...TABULAR_NUMS],
  },
});
