import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
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
import type { CapturedRecord } from '../services/autoLedger';
import { showAlert } from '../services/dialog';
import { triggerSelectionHaptic, triggerSuccessHaptic } from '../services/haptics';
import type { TransactionType } from '../types/ledger';
import { formatLocalDateTime } from '../utils/date';
import { parseYuanToCents } from '../utils/money';

interface CaptureConfirmModalProps {
  visible: boolean;
  capture: CapturedRecord | null;
  onClose: () => void;
}

const CHANNEL_LABEL: Record<CapturedRecord['channel'], string> = {
  notification: '通知监听识别',
  accessibility: '无障碍服务识别',
  demo: '模拟通知演示',
};

export function CaptureConfirmModal({
  visible,
  capture,
  onClose,
}: CaptureConfirmModalProps) {
  const insets = useSafeAreaInsets();
  const { categories, confirmPendingCapture, ignorePendingCapture } = useLedger();

  const [type, setType] = useState<TransactionType>('expense');
  const [amountText, setAmountText] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !capture) return;
    setType(capture.type);
    setAmountText((capture.amountCents / 100).toFixed(2));
    const matching = categories.filter((c) => c.type === capture.type);
    const hasSuggested = matching.some((c) => c.id === capture.suggestedCategoryId);
    setCategoryId(
      hasSuggested ? capture.suggestedCategoryId : matching[0]?.id ?? ''
    );
    setNote(
      capture.merchant
        ? `${capture.merchant}（${capture.sourceApp}）`
        : capture.sourceApp
    );
    setSaving(false);
  }, [visible, capture, categories]);

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type]
  );

  const handleSwitchType = (nextType: TransactionType) => {
    if (nextType === type) return;
    triggerSelectionHaptic();
    setType(nextType);
    const matching = categories.filter((c) => c.type === nextType);
    if (!matching.some((c) => c.id === categoryId)) {
      setCategoryId(matching[0]?.id ?? '');
    }
  };

  const handleConfirm = async () => {
    if (!capture || saving) return;
    const cents = parseYuanToCents(amountText);
    if (cents === null) {
      showAlert('金额无效', '请输入大于 0 的有效金额（最多两位小数）');
      return;
    }
    const chosen =
      filteredCategories.find((c) => c.id === categoryId) ??
      filteredCategories[0];
    if (!chosen) {
      showAlert('缺少分类', '请先创建一个分类后再保存');
      return;
    }

    setSaving(true);
    try {
      await confirmPendingCapture(capture.id, {
        type,
        amountCents: cents,
        categoryId: chosen.id,
        note: note.trim(),
        occurredAt: capture.occurredAt || formatLocalDateTime(),
      });
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

  const handleIgnore = async () => {
    if (!capture || saving) return;
    setSaving(true);
    try {
      await ignorePendingCapture(capture.id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!capture) return null;

  const accent = type === 'expense' ? COLORS.expense : COLORS.income;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.dismissArea} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, SPACING.lg) },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.sourcePill}>
              <Ionicons
                name="notifications-outline"
                size={14}
                color={COLORS.primary}
              />
              <Text style={styles.sourcePillText}>
                {capture.sourceApp} · {CHANNEL_LABEL[capture.channel]}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalTitle}>确认是否记账与分类</Text>
          {capture.rawSummary ? (
            <Text style={styles.rawSummary} numberOfLines={2}>
              识别原文：{capture.rawSummary}
            </Text>
          ) : null}

          <View style={styles.typeSegmented}>
            <TouchableOpacity
              onPress={() => handleSwitchType('expense')}
              style={[
                styles.segBtn,
                type === 'expense' && styles.segBtnExpense,
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
              onPress={() => handleSwitchType('income')}
              style={[styles.segBtn, type === 'income' && styles.segBtnIncome]}
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

          <View style={styles.amountBox}>
            <Text style={[styles.currency, { color: accent }]}>¥</Text>
            <TextInput
              style={[styles.amountInput, { color: accent }]}
              value={amountText}
              onChangeText={setAmountText}
              keyboardType="decimal-pad"
              selectTextOnFocus
            />
          </View>

          <Text style={styles.sectionLabel}>选择账单类型</Text>
          <ScrollView
            style={styles.catScroll}
            contentContainerStyle={styles.catGrid}
            showsVerticalScrollIndicator={false}
          >
            {filteredCategories.map((cat) => {
              const selected = cat.id === categoryId;
              const isSuggested = cat.id === capture.suggestedCategoryId;
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
                      styles.catBadge,
                      selected
                        ? { backgroundColor: cat.color }
                        : { backgroundColor: `${cat.color}1A` },
                    ]}
                  >
                    <Ionicons
                      name={cat.icon as keyof typeof Ionicons.glyphMap}
                      size={20}
                      color={selected ? COLORS.white : cat.color}
                    />
                    {isSuggested ? (
                      <View style={styles.recommendPill}>
                        <Text style={styles.recommendText}>推荐</Text>
                      </View>
                    ) : null}
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
          </ScrollView>

          <View style={styles.noteWrap}>
            <Ionicons
              name="create-outline"
              size={16}
              color={COLORS.textMuted}
            />
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="备注说明"
              placeholderTextColor={COLORS.textMuted}
              maxLength={60}
            />
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleIgnore}
              disabled={saving}
              style={styles.ignoreBtn}
            >
              <Text style={styles.ignoreBtnText}>忽略这笔</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleConfirm}
              disabled={saving}
              style={[
                styles.confirmBtn,
                { backgroundColor: accent },
                saving && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.confirmBtnText}>
                {saving ? '保存中...' : '确认记账'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    maxHeight: '90%',
    ...SHADOW.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  sourcePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
  },
  sourcePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 4,
  },
  rawSummary: {
    fontSize: 12,
    color: COLORS.textSecondary,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    marginTop: SPACING.xs,
  },
  typeSegmented: {
    flexDirection: 'row',
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.pill,
    padding: 3,
    marginTop: SPACING.md,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
  },
  segBtnExpense: {
    backgroundColor: COLORS.expense,
  },
  segBtnIncome: {
    backgroundColor: COLORS.income,
  },
  segText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  segTextActive: {
    color: COLORS.white,
  },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.md,
    gap: 4,
  },
  currency: {
    fontSize: 22,
    fontWeight: '700',
  },
  amountInput: {
    fontSize: 30,
    fontWeight: '800',
    fontVariant: [...TABULAR_NUMS],
    minWidth: 110,
    textAlign: 'center',
    paddingVertical: 0,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
    marginBottom: 4,
  },
  catScroll: {
    maxHeight: 188,
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: 4,
  },
  catTile: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: 7,
  },
  catBadge: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    position: 'relative',
  },
  recommendPill: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  recommendText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.white,
  },
  catName: {
    fontSize: 12,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  noteWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'android' ? 6 : 9,
    marginTop: SPACING.sm,
  },
  noteInput: {
    flex: 1,
    fontSize: 13.5,
    color: COLORS.textPrimary,
    paddingVertical: 2,
  },
  footer: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  ignoreBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
  },
  ignoreBtnText: {
    fontSize: 14.5,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: COLORS.white,
  },
});
