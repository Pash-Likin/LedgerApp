import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CategoryEditorModal } from '../components/CategoryEditorModal';
import { COLORS, RADIUS, SHADOW, SPACING } from '../constants/theme';
import { useLedger } from '../context/LedgerContext';
import { autoLedger, type AutoLedgerSettings } from '../services/autoLedger';
import { showAlert, showConfirm } from '../services/dialog';
import {
  isHapticsEnabled,
  setHapticsEnabled,
  subscribeHapticsChanged,
  triggerSelectionHaptic,
  triggerSuccessHaptic,
} from '../services/haptics';
import type { Category, TransactionType } from '../types/ledger';
import { formatYearMonthLabel } from '../utils/date';

interface CategoriesScreenProps {
  onOpenAutoCenter: () => void;
}

export function CategoriesScreen({ onOpenAutoCenter }: CategoriesScreenProps) {
  const {
    categories,
    selectedMonth,
    pendingCaptures,
    addCategory,
    updateCategory,
    deleteCategory,
    seedDemoData,
    clearAllTransactions,
  } = useLedger();

  const [activeType, setActiveType] = useState<TransactionType>('expense');
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [busyAction, setBusyAction] = useState(false);
  const [hapticsOn, setHapticsOn] = useState<boolean>(() => isHapticsEnabled());
  const [captureSettings, setCaptureSettings] = useState<AutoLedgerSettings>(
    () => autoLedger.getSettings()
  );

  const autoCaptureOn =
    captureSettings.notificationEnabled || captureSettings.accessibilityEnabled;

  useEffect(() => {
    const unsubHaptics = subscribeHapticsChanged((enabled) =>
      setHapticsOn(enabled)
    );
    const unsubSettings = autoLedger.subscribeSettingsChanged((next) =>
      setCaptureSettings(next)
    );
    return () => {
      unsubHaptics();
      unsubSettings();
    };
  }, []);

  const handleToggleHaptics = (value: boolean) => {
    setHapticsEnabled(value);
    setHapticsOn(value);
    if (value) {
      triggerSelectionHaptic();
    }
  };

  const handleToggleAutoCapture = (value: boolean) => {
    triggerSelectionHaptic();
    const next: AutoLedgerSettings = value
      ? {
          ...captureSettings,
          notificationEnabled: true,
          accessibilityEnabled: captureSettings.accessibilityEnabled,
        }
      : {
          ...captureSettings,
          notificationEnabled: false,
          accessibilityEnabled: false,
        };
    setCaptureSettings(next);
    autoLedger.updateSettings(next);
  };

  const visibleCategories = useMemo(
    () => categories.filter((c) => c.type === activeType),
    [categories, activeType]
  );

  const openCreateModal = () => {
    setEditingCategory(null);
    setEditorVisible(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setEditorVisible(true);
  };

  const handleDeleteCategory = (cat: Category) => {
    if (cat.isFallback) {
      showAlert('不可删除', '系统保底分类用于承接已删分类的历史账单，不可删除。');
      return;
    }

    const fallbackName = cat.type === 'expense' ? '其他支出' : '其他收入';
    showConfirm({
      title: '删除分类',
      message: `确定删除「${cat.name}」吗？该分类下已有的历史账单会自动迁移到「${fallbackName}」，不会丢失金额记录。`,
      confirmText: '确认删除',
      destructive: true,
      onConfirm: async () => {
        try {
          const { reassignedCount } = await deleteCategory(cat.id);
          triggerSuccessHaptic();
          if (reassignedCount > 0) {
            showAlert(
              '分类已删除',
              `已自动将 ${reassignedCount} 笔历史记录迁移至「${fallbackName}」。`
            );
          }
        } catch (err) {
          showAlert(
            '删除失败',
            err instanceof Error ? err.message : '请稍后重试'
          );
        }
      },
    });
  };

  const handleSeedDemo = async () => {
    if (busyAction) return;
    setBusyAction(true);
    try {
      const count = await seedDemoData(selectedMonth);
      triggerSuccessHaptic();
      showAlert(
        '示例数据已添加',
        `已为 ${formatYearMonthLabel(selectedMonth)} 添加 ${count} 笔示例账单。`
      );
    } catch (err) {
      showAlert(
        '添加失败',
        err instanceof Error ? err.message : '请稍后重试'
      );
    } finally {
      setBusyAction(false);
    }
  };

  const handleClearAll = () => {
    if (busyAction) return;
    showConfirm({
      title: '清空全部账单',
      message: '将永久删除所有月份的收支记录（自定义分类会保留）。此操作不可撤销，确定继续吗？',
      confirmText: '确认清空',
      destructive: true,
      onConfirm: async () => {
        setBusyAction(true);
        try {
          await clearAllTransactions();
          triggerSuccessHaptic();
          showAlert('已清空', '所有账单记录已清空。');
        } catch (err) {
          showAlert(
            '清空失败',
            err instanceof Error ? err.message : '请稍后重试'
          );
        } finally {
          setBusyAction(false);
        }
      },
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>分类与数据</Text>
        <TouchableOpacity
          onPress={openCreateModal}
          style={styles.addBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="add-outline" size={18} color={COLORS.white} />
          <Text style={styles.addBtnText}>新增分类</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Desktop Widget & Optional Auto-Ledger Entry Card */}
        <TouchableOpacity
          onPress={onOpenAutoCenter}
          activeOpacity={0.8}
          style={styles.autoCard}
        >
          <View style={styles.autoCardLeft}>
            <View style={styles.autoIconWrap}>
              <Ionicons name="apps-outline" size={21} color={COLORS.white} />
            </View>
            <View style={styles.autoTextWrap}>
              <View style={styles.autoTitleRow}>
                <Text style={styles.autoTitle}>桌面小组件与扩展功能</Text>
                {pendingCaptures.length > 0 ? (
                  <View style={styles.autoPendingBadge}>
                    <Text style={styles.autoPendingText}>
                      {pendingCaptures.length} 待确认
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.autoSub}>
                添加桌面小组件 · 付款通知自动记账（
                {autoCaptureOn ? '已开启' : '未开启，可选'}）
              </Text>
            </View>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={COLORS.primaryDark}
          />
        </TouchableOpacity>

        {/* Type Segmented */}
        <View style={styles.typeSegmented}>
          <TouchableOpacity
            onPress={() => {
              triggerSelectionHaptic();
              setActiveType('expense');
            }}
            style={[
              styles.typeTab,
              activeType === 'expense' && styles.typeTabExpense,
            ]}
          >
            <Text
              style={[
                styles.typeTabText,
                activeType === 'expense' && styles.typeTabTextActive,
              ]}
            >
              支出分类
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              triggerSelectionHaptic();
              setActiveType('income');
            }}
            style={[
              styles.typeTab,
              activeType === 'income' && styles.typeTabIncome,
            ]}
          >
            <Text
              style={[
                styles.typeTabText,
                activeType === 'income' && styles.typeTabTextActive,
              ]}
            >
              收入分类
            </Text>
          </TouchableOpacity>
        </View>

        {/* Category List Card */}
        <View style={styles.card}>
          {visibleCategories.map((cat, idx) => {
            const isLast = idx === visibleCategories.length - 1;
            return (
              <View
                key={cat.id}
                style={[styles.catRow, !isLast && styles.catRowBorder]}
              >
                <View
                  style={[
                    styles.catIconBadge,
                    { backgroundColor: `${cat.color}1A` },
                  ]}
                >
                  <Ionicons
                    name={cat.icon as keyof typeof Ionicons.glyphMap}
                    size={20}
                    color={cat.color}
                  />
                </View>

                <View style={styles.catInfo}>
                  <View style={styles.catNameRow}>
                    <Text style={styles.catName}>{cat.name}</Text>
                    <View
                      style={[
                        styles.tagPill,
                        cat.isFallback
                          ? styles.tagFallback
                          : cat.isDefault
                          ? styles.tagDefault
                          : styles.tagCustom,
                      ]}
                    >
                      <Text
                        style={[
                          styles.tagText,
                          cat.isFallback
                            ? styles.tagTextFallback
                            : cat.isDefault
                            ? styles.tagTextDefault
                            : styles.tagTextCustom,
                        ]}
                      >
                        {cat.isFallback
                          ? '系统保底'
                          : cat.isDefault
                          ? '系统预设'
                          : '自定义'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.catActions}>
                  <TouchableOpacity
                    onPress={() => openEditModal(cat)}
                    style={styles.actionBtn}
                    accessibilityLabel={`编辑${cat.name}`}
                  >
                    <Ionicons
                      name="create-outline"
                      size={18}
                      color={COLORS.textSecondary}
                    />
                  </TouchableOpacity>
                  {!cat.isFallback ? (
                    <TouchableOpacity
                      onPress={() => handleDeleteCategory(cat)}
                      style={[styles.actionBtn, styles.deleteBtn]}
                      accessibilityLabel={`删除${cat.name}`}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={COLORS.expense}
                      />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>

        {/* Preferences Card */}
        <View style={styles.card}>
          <Text style={styles.dataTitle}>偏好设置</Text>
          <View style={[styles.prefRow, styles.prefRowBorder]}>
            <View style={styles.prefTextCol}>
              <Text style={styles.prefLabel}>记账与按键震动反馈</Text>
              <Text style={styles.prefSub}>
                关闭后点击键盘、保存记账及提醒通知均不再震动
              </Text>
            </View>
            <Switch
              value={hapticsOn}
              onValueChange={handleToggleHaptics}
              trackColor={{ false: COLORS.border, true: COLORS.primaryTint }}
              thumbColor={hapticsOn ? COLORS.primary : COLORS.textMuted}
            />
          </View>
          <View style={styles.prefRow}>
            <View style={styles.prefTextCol}>
              <Text style={styles.prefLabel}>付款通知自动记账（可选）</Text>
              <Text style={styles.prefSub}>
                {autoCaptureOn
                  ? '已开启，可点上方「桌面小组件与扩展功能」配置权限或查看日志'
                  : '默认关闭，无需强制开启，关闭时仅使用手动记账'}
              </Text>
            </View>
            <Switch
              value={autoCaptureOn}
              onValueChange={handleToggleAutoCapture}
              trackColor={{ false: COLORS.border, true: COLORS.primaryTint }}
              thumbColor={autoCaptureOn ? COLORS.primary : COLORS.textMuted}
            />
          </View>
        </View>

        {/* Data Management Card */}
        <View style={styles.card}>
          <Text style={styles.dataTitle}>本地账本数据管理</Text>
          <Text style={styles.dataDesc}>
            所有账单均保存在手机本地数据库，无需联网登录，也不会上传云端。
          </Text>

          <View style={styles.dataActions}>
            <TouchableOpacity
              onPress={handleSeedDemo}
              disabled={busyAction}
              style={styles.demoBtn}
              activeOpacity={0.75}
            >
              <Ionicons
                name="calendar-outline"
                size={18}
                color={COLORS.primary}
              />
              <Text style={styles.demoBtnText}>
                添加 {formatYearMonthLabel(selectedMonth)} 示例数据
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleClearAll}
              disabled={busyAction}
              style={styles.clearBtn}
              activeOpacity={0.75}
            >
              <Ionicons name="trash-outline" size={18} color={COLORS.expense} />
              <Text style={styles.clearBtnText}>清空全部账单记录</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <CategoryEditorModal
        visible={editorVisible}
        type={activeType}
        editingCategory={editingCategory}
        onSave={async (payload) => {
          if (editingCategory) {
            await updateCategory(editingCategory.id, {
              name: payload.name,
              icon: payload.icon,
              color: payload.color,
            });
          } else {
            await addCategory(payload);
          }
        }}
        onClose={() => setEditorVisible(false)}
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
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
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
  },
  typeTabTextActive: {
    color: COLORS.white,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    ...SHADOW.card,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: SPACING.md,
  },
  catRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  catIconBadge: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  catInfo: {
    flex: 1,
  },
  catNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  tagPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
  },
  tagDefault: {
    backgroundColor: COLORS.bg,
  },
  tagFallback: {
    backgroundColor: COLORS.warningSoft,
  },
  tagCustom: {
    backgroundColor: COLORS.primarySoft,
  },
  tagText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  tagTextDefault: {
    color: COLORS.textSecondary,
  },
  tagTextFallback: {
    color: COLORS.warning,
  },
  tagTextCustom: {
    color: COLORS.primary,
  },
  catActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: {
    backgroundColor: COLORS.expenseSoft,
  },
  dataTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: SPACING.sm,
  },
  prefRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  prefTextCol: {
    flex: 1,
  },
  prefLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  prefSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },
  dataDesc: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: SPACING.md,
  },
  dataActions: {
    gap: SPACING.sm,
  },
  demoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryTint,
    borderRadius: RADIUS.md,
    paddingVertical: 11,
  },
  demoBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.primary,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.expenseSoft,
    borderRadius: RADIUS.md,
    paddingVertical: 11,
  },
  clearBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.expense,
  },
  autoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryTint,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  autoCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  autoIconWrap: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  autoTextWrap: {
    flex: 1,
  },
  autoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  autoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  autoPendingBadge: {
    backgroundColor: COLORS.expense,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  autoPendingText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.white,
  },
  autoSub: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 2,
  },
});
