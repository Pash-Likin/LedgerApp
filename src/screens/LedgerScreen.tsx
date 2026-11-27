import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MonthSwitcher } from '../components/MonthSwitcher';
import { COLORS, RADIUS, SHADOW, SPACING, TABULAR_NUMS } from '../constants/theme';
import { useLedger } from '../context/LedgerContext';
import { showAlert } from '../services/dialog';
import type { CapturedRecord } from '../services/autoLedger';
import { triggerSelectionHaptic, triggerSuccessHaptic } from '../services/haptics';
import type {
  DailyTransactionSection,
  TransactionType,
  TransactionWithCategory,
} from '../types/ledger';
import { computeMonthlySummary, groupTransactionsByDate } from '../utils/analytics';
import { extractTimeHHmm } from '../utils/date';
import { formatSignedYuan, formatYuan } from '../utils/money';

interface LedgerScreenProps {
  onOpenCreate: () => void;
  onEditTransaction: (tx: TransactionWithCategory) => void;
  onOpenAutoCenter: () => void;
  onReviewCapture: (capture: CapturedRecord) => void;
}

type FilterType = 'all' | TransactionType;

export function LedgerScreen({
  onOpenCreate,
  onEditTransaction,
  onOpenAutoCenter,
  onReviewCapture,
}: LedgerScreenProps) {
  const {
    selectedMonth,
    setSelectedMonth,
    transactions,
    pendingCaptures,
    isLoadingMonth,
    seedDemoData,
  } = useLedger();

  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [seeding, setSeeding] = useState(false);

  const summary = useMemo(
    () => computeMonthlySummary(selectedMonth, transactions),
    [selectedMonth, transactions]
  );

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (filterType !== 'all' && tx.type !== filterType) {
        return false;
      }
      if (!q) return true;
      return (
        tx.categoryName.toLowerCase().includes(q) ||
        tx.note.toLowerCase().includes(q)
      );
    });
  }, [transactions, filterType, searchQuery]);

  const sections = useMemo<DailyTransactionSection[]>(
    () => groupTransactionsByDate(filteredTransactions),
    [filteredTransactions]
  );

  const handleSeedDemo = async () => {
    if (seeding) return;
    setSeeding(true);
    try {
      const count = await seedDemoData(selectedMonth);
      triggerSuccessHaptic();
      showAlert('示例账单已生成', `已为当前月份添加 ${count} 笔示例收支记录。`);
    } catch (err) {
      showAlert(
        '生成失败',
        err instanceof Error ? err.message : '请稍后重试'
      );
    } finally {
      setSeeding(false);
    }
  };

  const hasActiveFilter = filterType !== 'all' || searchQuery.trim().length > 0;

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.brandTitle}>轻记账</Text>
          <Text style={styles.brandSub}>清晰记录每一笔花销</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={onOpenAutoCenter}
            style={styles.autoCenterIconBtn}
            accessibilityLabel="小组件与扩展功能"
            hitSlop={6}
          >
            <Ionicons name="apps-outline" size={19} color={COLORS.primary} />
            {pendingCaptures.length > 0 ? (
              <View style={styles.pendingDot} />
            ) : null}
          </TouchableOpacity>
          <MonthSwitcher yearMonth={selectedMonth} onChange={setSelectedMonth} />
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Summary Hero Card */}
            <View style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroMainStat}>
                  <Text style={styles.heroLabel}>本月总支出</Text>
                  <Text
                    style={styles.heroMainAmount}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    ¥{formatYuan(summary.totalExpenseCents)}
                  </Text>
                </View>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>
                    共 {summary.totalCount} 笔
                  </Text>
                </View>
              </View>

              <View style={styles.heroBottomRow}>
                <View style={styles.heroSubStat}>
                  <Text style={styles.heroSubLabel}>本月收入</Text>
                  <Text style={styles.heroSubAmount} numberOfLines={1}>
                    ¥{formatYuan(summary.totalIncomeCents)}
                  </Text>
                </View>
                <View style={styles.heroDivider} />
                <View style={styles.heroSubStat}>
                  <Text style={styles.heroSubLabel}>本月结余</Text>
                  <Text style={styles.heroSubAmount} numberOfLines={1}>
                    {summary.netCents < 0 ? '-¥' : '¥'}
                    {formatYuan(Math.abs(summary.netCents))}
                  </Text>
                </View>
              </View>
            </View>

            {/* Pending Auto-Captures Banner */}
            {pendingCaptures.length > 0 ? (
              <TouchableOpacity
                onPress={() => onReviewCapture(pendingCaptures[0])}
                activeOpacity={0.8}
                style={styles.captureBanner}
              >
                <View style={styles.captureBannerIcon}>
                  <Ionicons
                    name="notifications-outline"
                    size={18}
                    color={COLORS.white}
                  />
                </View>
                <View style={styles.captureBannerBody}>
                  <Text style={styles.captureBannerTitle} numberOfLines={1}>
                    检测到 {pendingCaptures.length} 笔新消费待确认
                  </Text>
                  <Text style={styles.captureBannerSub} numberOfLines={1}>
                    {pendingCaptures[0].merchant} · ¥
                    {formatYuan(pendingCaptures[0].amountCents)} · 点击确认类型
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={COLORS.primaryDark}
                />
              </TouchableOpacity>
            ) : null}

            {/* Filter & Search Bar */}
            <View style={styles.filterSection}>
              <View style={styles.filterPills}>
                {[
                  { key: 'all' as const, label: '全部' },
                  { key: 'expense' as const, label: '支出' },
                  { key: 'income' as const, label: '收入' },
                ].map((tab) => {
                  const active = filterType === tab.key;
                  return (
                    <TouchableOpacity
                      key={tab.key}
                      onPress={() => {
                        triggerSelectionHaptic();
                        setFilterType(tab.key);
                      }}
                      style={[
                        styles.filterPill,
                        active && styles.filterPillActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterPillText,
                          active && styles.filterPillTextActive,
                        ]}
                      >
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.searchBox}>
                <Ionicons
                  name="search-outline"
                  size={16}
                  color={COLORS.textMuted}
                />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="搜索分类或备注"
                  placeholderTextColor={COLORS.textMuted}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 ? (
                  <TouchableOpacity
                    onPress={() => setSearchQuery('')}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="close-circle"
                      size={16}
                      color={COLORS.textMuted}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {isLoadingMonth ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.loadingText}>正在加载账单...</Text>
              </View>
            ) : null}
          </>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionDate}>{section.label}</Text>
            <View style={styles.sectionTotals}>
              {section.incomeCents > 0 ? (
                <Text style={styles.sectionTotalText}>
                  收 ¥{formatYuan(section.incomeCents)}
                </Text>
              ) : null}
              {section.expenseCents > 0 ? (
                <Text style={styles.sectionTotalText}>
                  支 ¥{formatYuan(section.expenseCents)}
                </Text>
              ) : null}
            </View>
          </View>
        )}
        renderItem={({ item, index, section }) => {
          const isFirst = index === 0;
          const isLast = index === section.data.length - 1;
          return (
            <TouchableOpacity
              onPress={() => onEditTransaction(item)}
              activeOpacity={0.75}
              style={[
                styles.txRow,
                isFirst && styles.txRowFirst,
                isLast && styles.txRowLast,
                !isLast && styles.txRowBorder,
              ]}
            >
              <View
                style={[
                  styles.txIconBadge,
                  { backgroundColor: `${item.categoryColor}1A` },
                ]}
              >
                <Ionicons
                  name={item.categoryIcon as keyof typeof Ionicons.glyphMap}
                  size={20}
                  color={item.categoryColor}
                />
              </View>

              <View style={styles.txBody}>
                <Text style={styles.txCategory} numberOfLines={1}>
                  {item.categoryName}
                </Text>
                <Text style={styles.txMeta} numberOfLines={1}>
                  {extractTimeHHmm(item.occurredAt)}
                  {item.note.trim() ? ` · ${item.note.trim()}` : ''}
                </Text>
              </View>

              <Text
                style={[
                  styles.txAmount,
                  item.type === 'expense'
                    ? styles.txAmountExpense
                    : styles.txAmountIncome,
                ]}
              >
                {formatSignedYuan(item.amountCents, item.type)}
              </Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          isLoadingMonth ? undefined : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Ionicons
                  name="receipt-outline"
                  size={34}
                  color={COLORS.primary}
                />
              </View>
              {hasActiveFilter ? (
                <>
                  <Text style={styles.emptyTitle}>没有符合条件的记录</Text>
                  <Text style={styles.emptyDesc}>
                    试试更换筛选条件或清空搜索关键词
                  </Text>
                  <TouchableOpacity
                    style={styles.primaryEmptyBtn}
                    onPress={() => {
                      setFilterType('all');
                      setSearchQuery('');
                    }}
                  >
                    <Text style={styles.primaryEmptyBtnText}>清空筛选</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.emptyTitle}>本月还没有记账记录</Text>
                  <Text style={styles.emptyDesc}>
                    点击下方按钮立刻记下一笔花销，或填入示例数据体验月度统计与账单导出
                  </Text>
                  <TouchableOpacity
                    style={styles.primaryEmptyBtn}
                    onPress={onOpenCreate}
                  >
                    <Ionicons
                      name="add-outline"
                      size={18}
                      color={COLORS.white}
                    />
                    <Text style={styles.primaryEmptyBtnText}>记下第一笔</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryEmptyBtn}
                    onPress={handleSeedDemo}
                    disabled={seeding}
                  >
                    <Text style={styles.secondaryEmptyBtnText}>
                      {seeding ? '正在生成...' : '填入示例账单体验'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )
        }
      />
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
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: 0.3,
  },
  brandSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  autoCenterIconBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  pendingDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.expense,
  },
  captureBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryTint,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    marginBottom: SPACING.md,
  },
  captureBannerIcon: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureBannerBody: {
    flex: 1,
  },
  captureBannerTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  captureBannerSub: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 1,
    fontVariant: [...TABULAR_NUMS],
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 28,
  },
  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
    ...SHADOW.card,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroMainStat: {
    flex: 1,
    paddingRight: SPACING.sm,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primaryTint,
    marginBottom: 4,
  },
  heroMainAmount: {
    fontSize: 30,
    fontWeight: '800',
    color: COLORS.white,
    fontVariant: [...TABULAR_NUMS],
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.white,
    fontVariant: [...TABULAR_NUMS],
  },
  heroBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.16)',
  },
  heroSubStat: {
    flex: 1,
  },
  heroDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: SPACING.md,
  },
  heroSubLabel: {
    fontSize: 11,
    color: COLORS.primaryTint,
    marginBottom: 2,
  },
  heroSubAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
    fontVariant: [...TABULAR_NUMS],
  },
  filterSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  filterPills: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.pill,
    padding: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterPill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
  },
  filterPillActive: {
    backgroundColor: COLORS.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  filterPillTextActive: {
    color: COLORS.white,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'android' ? 4 : 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textPrimary,
    paddingVertical: 1,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: SPACING.md,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  sectionDate: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  sectionTotals: {
    flexDirection: 'row',
    gap: 10,
  },
  sectionTotalText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    fontVariant: [...TABULAR_NUMS],
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    gap: SPACING.md,
  },
  txRowFirst: {
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
  },
  txRowLast: {
    borderBottomLeftRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
  },
  txRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  txIconBadge: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txBody: {
    flex: 1,
  },
  txCategory: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  txMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 16,
    fontWeight: '800',
    fontVariant: [...TABULAR_NUMS],
  },
  txAmountExpense: {
    color: COLORS.expense,
  },
  txAmountIncome: {
    color: COLORS.income,
  },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xxl,
    alignItems: 'center',
    marginTop: SPACING.sm,
    ...SHADOW.card,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  primaryEmptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: RADIUS.pill,
  },
  primaryEmptyBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
  secondaryEmptyBtn: {
    marginTop: SPACING.md,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primarySoft,
  },
  secondaryEmptyBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
});
