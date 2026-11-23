import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOW, SPACING, TABULAR_NUMS } from '../constants/theme';
import { useLedger } from '../context/LedgerContext';
import { showAlert, showConfirm } from '../services/dialog';
import {
  triggerLightHaptic,
  triggerSelectionHaptic,
  triggerSuccessHaptic,
} from '../services/haptics';
import type { TransactionType, TransactionWithCategory } from '../types/ledger';
import {
  extractDateKey,
  formatDayHeaderLabel,
  formatLocalDateTime,
  getCurrentYearMonth,
  getTodayDateKey,
  offsetDateKey,
} from '../utils/date';
import { evaluateKeypadToCents, formatYuan } from '../utils/money';
import { CategoryEditorModal } from './CategoryEditorModal';
import { DatePickerModal } from './DatePickerModal';

interface TransactionModalProps {
  visible: boolean;
  editingTransaction: TransactionWithCategory | null;
  onClose: () => void;
}

const KEYPAD_ROWS: readonly string[][] = [
  ['7', '8', '9', '⌫'],
  ['4', '5', '6', '+'],
  ['1', '2', '3', '-'],
  ['.', '0', '清空', '完成'],
];

export function TransactionModal({
  visible,
  editingTransaction,
  onClose,
}: TransactionModalProps) {
  const insets = useSafeAreaInsets();
  const {
    categories,
    selectedMonth,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addCategory,
  } = useLedger();

  const [type, setType] = useState<TransactionType>('expense');
  const [expr, setExpr] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [dateKey, setDateKey] = useState(() => getTodayDateKey());
  const [note, setNote] = useState('');
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [catEditorVisible, setCatEditorVisible] = useState(false);
  const [systemKeyboardOpen, setSystemKeyboardOpen] = useState(false);

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type]
  );

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(showEvent, () =>
      setSystemKeyboardOpen(true)
    );
    const subHide = Keyboard.addListener(hideEvent, () =>
      setSystemKeyboardOpen(false)
    );
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    setErrorHint(null);
    setSaving(false);
    setSystemKeyboardOpen(false);

    if (editingTransaction) {
      setType(editingTransaction.type);
      setCategoryId(editingTransaction.categoryId);
      setExpr(String(editingTransaction.amountCents / 100));
      setDateKey(extractDateKey(editingTransaction.occurredAt));
      setNote(editingTransaction.note);
    } else {
      setType('expense');
      const firstExpense = categories.find((c) => c.type === 'expense');
      setCategoryId(firstExpense?.id ?? '');
      setExpr('');
      const currentMonth = getCurrentYearMonth();
      setDateKey(
        selectedMonth === currentMonth ? getTodayDateKey() : `${selectedMonth}-01`
      );
      setNote('');
    }
  }, [visible, editingTransaction, categories, selectedMonth]);

  // Keep categoryId synchronized when switching type
  const handleTypeChange = (nextType: TransactionType) => {
    if (nextType === type) return;
    triggerSelectionHaptic();
    setType(nextType);
    const matching = categories.filter((c) => c.type === nextType);
    if (!matching.some((c) => c.id === categoryId)) {
      setCategoryId(matching[0]?.id ?? '');
    }
  };

  const todayKey = getTodayDateKey();
  const yesterdayKey = offsetDateKey(todayKey, -1);
  const dayBeforeKey = offsetDateKey(todayKey, -2);

  const evaluatedCents = useMemo(() => evaluateKeypadToCents(expr), [expr]);
  const hasOperator = expr.includes('+') || expr.includes('-');
  const accentColor = type === 'expense' ? COLORS.expense : COLORS.income;

  const handleSubmit = async () => {
    if (saving) return;
    const cents = evaluateKeypadToCents(expr);
    if (cents === null) {
      setErrorHint('请输入大于 0 的金额');
      return;
    }
    const chosenCat =
      filteredCategories.find((c) => c.id === categoryId) ??
      filteredCategories[0];
    if (!chosenCat) {
      showAlert('缺少分类', '请先创建一个分类后再记账');
      return;
    }

    const timePart = editingTransaction
      ? editingTransaction.occurredAt.slice(11)
      : formatLocalDateTime().slice(11);
    const occurredAt = `${dateKey}T${timePart}`;

    setSaving(true);
    setErrorHint(null);
    try {
      if (editingTransaction) {
        await updateTransaction(editingTransaction.id, {
          type,
          amountCents: cents,
          categoryId: chosenCat.id,
          note,
          occurredAt,
        });
      } else {
        await addTransaction({
          type,
          amountCents: cents,
          categoryId: chosenCat.id,
          note,
          occurredAt,
        });
      }
      triggerSuccessHaptic();
      onClose();
    } catch (err) {
      showAlert(
        '保存失败',
        err instanceof Error ? err.message : '请稍后重试'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!editingTransaction || saving) return;
    showConfirm({
      title: '删除账单',
      message: `确定要删除这笔「${editingTransaction.categoryName}」记录吗？删除后无法恢复。`,
      confirmText: '删除',
      destructive: true,
      onConfirm: async () => {
        setSaving(true);
        try {
          await deleteTransaction(editingTransaction.id);
          triggerSuccessHaptic();
          onClose();
        } catch (err) {
          showAlert(
            '删除失败',
            err instanceof Error ? err.message : '请稍后重试'
          );
        } finally {
          setSaving(false);
        }
      },
    });
  };

  const handleKeyPress = (key: string) => {
    triggerLightHaptic();
    setErrorHint(null);

    if (key === '完成') {
      handleSubmit();
      return;
    }
    if (key === '清空') {
      setExpr('');
      return;
    }
    if (key === '⌫') {
      setExpr((prev) => prev.slice(0, -1));
      return;
    }

    setExpr((prev) => {
      if (prev.length >= 24) return prev;

      if (key === '+' || key === '-') {
        if (!prev) return prev;
        let base = prev;
        if (base.endsWith('.')) {
          base = base.slice(0, -1);
        }
        if (!base) return prev;
        if (base.endsWith('+') || base.endsWith('-')) {
          return `${base.slice(0, -1)}${key}`;
        }
        return `${base}${key}`;
      }

      const lastOpIdx = Math.max(prev.lastIndexOf('+'), prev.lastIndexOf('-'));
      const currentSegment = prev.slice(lastOpIdx + 1);

      if (key === '.') {
        if (currentSegment.includes('.')) return prev;
        if (!currentSegment) return `${prev}0.`;
        return `${prev}.`;
      }

      // Digit 0-9
      const dotIdx = currentSegment.indexOf('.');
      if (dotIdx !== -1 && currentSegment.length - dotIdx - 1 >= 2) {
        return prev;
      }
      if (currentSegment === '0') {
        if (key === '0') return prev;
        return `${prev.slice(0, lastOpIdx + 1)}${key}`;
      }
      return `${prev}${key}`;
    });
  };

  const isCustomDate =
    dateKey !== todayKey &&
    dateKey !== yesterdayKey &&
    dateKey !== dayBeforeKey;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropDismiss} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, SPACING.md) },
          ]}
        >
          {/* Header with type toggle */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn} hitSlop={8}>
              <Ionicons name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>

            <View style={styles.segmented}>
              <TouchableOpacity
                onPress={() => handleTypeChange('expense')}
                style={[
                  styles.segItem,
                  type === 'expense' && styles.segItemExpense,
                ]}
              >
                <Text
                  style={[
                    styles.segText,
                    type === 'expense' && styles.segTextActive,
                  ]}
                >
                  支出
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleTypeChange('income')}
                style={[
                  styles.segItem,
                  type === 'income' && styles.segItemIncome,
                ]}
              >
                <Text
                  style={[
                    styles.segText,
                    type === 'income' && styles.segTextActive,
                  ]}
                >
                  收入
                </Text>
              </TouchableOpacity>
            </View>

            {editingTransaction ? (
              <TouchableOpacity
                onPress={handleDelete}
                style={styles.iconBtn}
                hitSlop={8}
                accessibilityLabel="删除账单"
              >
                <Ionicons name="trash-outline" size={20} color={COLORS.expense} />
              </TouchableOpacity>
            ) : (
              <View style={styles.iconBtnPlaceholder} />
            )}
          </View>

          {/* Amount Display */}
          <View style={styles.amountBox}>
            <View style={styles.amountRow}>
              <Text style={[styles.currencySymbol, { color: accentColor }]}>
                ¥
              </Text>
              <Text
                style={[styles.amountText, { color: accentColor }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {expr || '0.00'}
              </Text>
            </View>
            {hasOperator && evaluatedCents !== null ? (
              <Text style={styles.calcPreview}>
                = ¥{formatYuan(evaluatedCents)}
              </Text>
            ) : errorHint ? (
              <Text style={styles.errorHint}>{errorHint}</Text>
            ) : (
              <Text style={styles.amountHint}>支持 + / - 计算输入</Text>
            )}
          </View>

          {/* Categories 4-column Grid */}
          <ScrollView
            style={styles.catScroll}
            contentContainerStyle={styles.catGrid}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {filteredCategories.map((cat) => {
              const selected = cat.id === categoryId;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => {
                    triggerSelectionHaptic();
                    setCategoryId(cat.id);
                  }}
                  style={styles.catTile}
                  activeOpacity={0.75}
                >
                  <View
                    style={[
                      styles.catIconCircle,
                      selected
                        ? { backgroundColor: cat.color }
                        : { backgroundColor: `${cat.color}18` },
                    ]}
                  >
                    <Ionicons
                      name={cat.icon as keyof typeof Ionicons.glyphMap}
                      size={22}
                      color={selected ? COLORS.white : cat.color}
                    />
                  </View>
                  <Text
                    style={[
                      styles.catName,
                      selected && { color: cat.color, fontWeight: '700' },
                    ]}
                    numberOfLines={1}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              onPress={() => setCatEditorVisible(true)}
              style={styles.catTile}
              activeOpacity={0.75}
            >
              <View style={styles.addCatCircle}>
                <Ionicons
                  name="add-outline"
                  size={24}
                  color={COLORS.textSecondary}
                />
              </View>
              <Text style={styles.catName}>新增</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Date Chips + Note Input */}
          <View style={styles.metaBlock}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dateChipsRow}
            >
              {[
                { label: '今天', key: todayKey },
                { label: '昨天', key: yesterdayKey },
                { label: '前天', key: dayBeforeKey },
              ].map((chip) => {
                const active = dateKey === chip.key;
                return (
                  <TouchableOpacity
                    key={chip.label}
                    onPress={() => {
                      triggerSelectionHaptic();
                      setDateKey(chip.key);
                    }}
                    style={[styles.dateChip, active && styles.dateChipActive]}
                  >
                    <Text
                      style={[
                        styles.dateChipText,
                        active && styles.dateChipTextActive,
                      ]}
                    >
                      {chip.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setDatePickerVisible(true);
                }}
                style={[
                  styles.dateChip,
                  styles.calendarChip,
                  isCustomDate && styles.dateChipActive,
                ]}
              >
                <Ionicons
                  name="calendar-outline"
                  size={13}
                  color={isCustomDate ? COLORS.white : COLORS.primary}
                />
                <Text
                  style={[
                    styles.dateChipText,
                    isCustomDate && styles.dateChipTextActive,
                  ]}
                >
                  {formatDayHeaderLabel(dateKey)}
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.noteInputRow}>
              <Ionicons
                name="create-outline"
                size={16}
                color={COLORS.textMuted}
              />
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="添加备注（例如：午饭、打车、超市采购）..."
                placeholderTextColor={COLORS.textMuted}
                maxLength={60}
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
              />
              {note.length > 0 ? (
                <TouchableOpacity onPress={() => setNote('')} hitSlop={8}>
                  <Ionicons
                    name="close-circle"
                    size={16}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* Built-in Calculator Keypad (hidden while system keyboard is up for note typing) */}
          {systemKeyboardOpen ? (
            <TouchableOpacity
              onPress={() => Keyboard.dismiss()}
              style={styles.keyboardDoneBar}
            >
              <Text style={styles.keyboardDoneText}>收起键盘以输入金额</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.keypad}>
              {KEYPAD_ROWS.map((row, rowIdx) => (
                <View key={rowIdx} style={styles.keypadRow}>
                  {row.map((keyLabel) => {
                    const isSubmit = keyLabel === '完成';
                    const isOp =
                      keyLabel === '+' ||
                      keyLabel === '-' ||
                      keyLabel === '⌫' ||
                      keyLabel === '清空';

                    return (
                      <TouchableOpacity
                        key={keyLabel}
                        onPress={() => handleKeyPress(keyLabel)}
                        disabled={isSubmit && saving}
                        activeOpacity={0.7}
                        style={[
                          styles.keyBtn,
                          isOp && styles.keyBtnOp,
                          isSubmit && {
                            backgroundColor: accentColor,
                          },
                          isSubmit && saving && { opacity: 0.65 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.keyText,
                            isOp && styles.keyTextOp,
                            isSubmit && styles.keyTextSubmit,
                          ]}
                        >
                          {isSubmit
                            ? saving
                              ? '保存中'
                              : editingTransaction
                              ? '保存'
                              : '完成'
                            : keyLabel}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      <DatePickerModal
        visible={datePickerVisible}
        selectedDateKey={dateKey}
        onSelect={setDateKey}
        onClose={() => setDatePickerVisible(false)}
      />

      <CategoryEditorModal
        visible={catEditorVisible}
        type={type}
        onSave={async (payload) => {
          const created = await addCategory(payload);
          setCategoryId(created.id);
        }}
        onClose={() => setCatEditorVisible(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  backdropDismiss: {
    flex: 1,
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingTop: SPACING.md,
    maxHeight: '92%',
    ...SHADOW.card,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnPlaceholder: {
    width: 34,
    height: 34,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.pill,
    padding: 3,
  },
  segItem: {
    paddingHorizontal: 22,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
  },
  segItemExpense: {
    backgroundColor: COLORS.expense,
  },
  segItemIncome: {
    backgroundColor: COLORS.income,
  },
  segText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  segTextActive: {
    color: COLORS.white,
  },
  amountBox: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surfaceAlt,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    gap: 4,
  },
  currencySymbol: {
    fontSize: 22,
    fontWeight: '700',
  },
  amountText: {
    fontSize: 32,
    fontWeight: '800',
    fontVariant: [...TABULAR_NUMS],
  },
  calcPreview: {
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    fontVariant: [...TABULAR_NUMS],
  },
  amountHint: {
    textAlign: 'right',
    fontSize: 11,
    color: COLORS.textMuted,
  },
  errorHint: {
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.expense,
  },
  catScroll: {
    maxHeight: 196,
    paddingHorizontal: SPACING.md,
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: SPACING.sm,
  },
  catTile: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  catIconCircle: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  addCatCircle: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  catName: {
    fontSize: 12,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  metaBlock: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    gap: SPACING.sm,
  },
  dateChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.bg,
  },
  calendarChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateChipActive: {
    backgroundColor: COLORS.primary,
  },
  dateChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  dateChipTextActive: {
    color: COLORS.white,
  },
  noteInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'android' ? 6 : 9,
  },
  noteInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    paddingVertical: 2,
  },
  keyboardDoneBar: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.xs,
    paddingVertical: 11,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
  },
  keyboardDoneText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  keypad: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
    gap: 7,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 7,
  },
  keyBtn: {
    flex: 1,
    height: 46,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyBtnOp: {
    backgroundColor: '#EAF0F6',
  },
  keyText: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.textPrimary,
    fontVariant: [...TABULAR_NUMS],
  },
  keyTextOp: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  keyTextSubmit: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
  },
});
