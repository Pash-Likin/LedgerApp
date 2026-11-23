import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CATEGORY_COLOR_OPTIONS,
  CATEGORY_ICON_OPTIONS,
} from '../constants/categories';
import { COLORS, RADIUS, SHADOW, SPACING } from '../constants/theme';
import { showAlert } from '../services/dialog';
import { triggerSelectionHaptic, triggerSuccessHaptic } from '../services/haptics';
import type { Category, TransactionType } from '../types/ledger';

interface CategoryEditorModalProps {
  visible: boolean;
  type: TransactionType;
  editingCategory?: Category | null;
  onSave: (payload: {
    name: string;
    type: TransactionType;
    icon: string;
    color: string;
  }) => Promise<void>;
  onClose: () => void;
}

export function CategoryEditorModal({
  visible,
  type,
  editingCategory,
  onSave,
  onClose,
}: CategoryEditorModalProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>(CATEGORY_ICON_OPTIONS[0]);
  const [color, setColor] = useState<string>(CATEGORY_COLOR_OPTIONS[0]);
  const [saving, setSaving] = useState(false);

  const effectiveType = editingCategory ? editingCategory.type : type;

  useEffect(() => {
    if (!visible) return;
    if (editingCategory) {
      setName(editingCategory.name);
      setIcon(editingCategory.icon);
      setColor(editingCategory.color);
    } else {
      setName('');
      setIcon(
        effectiveType === 'expense'
          ? CATEGORY_ICON_OPTIONS[0]
          : 'wallet-outline'
      );
      setColor(
        effectiveType === 'expense'
          ? CATEGORY_COLOR_OPTIONS[9]
          : CATEGORY_COLOR_OPTIONS[1]
      );
    }
    setSaving(false);
  }, [visible, editingCategory, effectiveType]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      showAlert('请输入分类名称', '分类名称不能为空，建议 2～6 个字');
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      await onSave({
        name: trimmed,
        type: effectiveType,
        icon,
        color,
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

  const title = editingCategory
    ? '编辑分类'
    : effectiveType === 'expense'
    ? '新增支出分类'
    : '新增收入分类';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.previewRow}>
              <View style={[styles.previewBadge, { backgroundColor: `${color}1A` }]}>
                <Ionicons
                  name={icon as keyof typeof Ionicons.glyphMap}
                  size={28}
                  color={color}
                />
              </View>
              <View style={styles.previewInputWrap}>
                <Text style={styles.fieldLabel}>分类名称</Text>
                <TextInput
                  style={styles.nameInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="例如：咖啡、宠物、房贷"
                  placeholderTextColor={COLORS.textMuted}
                  maxLength={8}
                  returnKeyType="done"
                />
              </View>
            </View>

            <Text style={styles.sectionLabel}>选择颜色</Text>
            <View style={styles.colorGrid}>
              {CATEGORY_COLOR_OPTIONS.map((c) => {
                const active = color === c;
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => {
                      triggerSelectionHaptic();
                      setColor(c);
                    }}
                    style={[
                      styles.colorDot,
                      { backgroundColor: c },
                      active && styles.colorDotActive,
                    ]}
                  >
                    {active ? (
                      <Ionicons name="checkmark" size={16} color={COLORS.white} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>选择图标</Text>
            <View style={styles.iconGrid}>
              {CATEGORY_ICON_OPTIONS.map((iconName) => {
                const active = icon === iconName;
                return (
                  <TouchableOpacity
                    key={iconName}
                    onPress={() => {
                      triggerSelectionHaptic();
                      setIcon(iconName);
                    }}
                    style={[
                      styles.iconCell,
                      active && {
                        backgroundColor: `${color}1A`,
                        borderColor: color,
                      },
                    ]}
                  >
                    <Ionicons
                      name={iconName as keyof typeof Ionicons.glyphMap}
                      size={22}
                      color={active ? color : COLORS.textSecondary}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={styles.cancelBtnText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.saveBtn,
                { backgroundColor: color },
                saving && styles.saveBtnDisabled,
              ]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>
                {saving ? '保存中...' : '保存分类'}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
    maxHeight: '88%',
    ...SHADOW.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.bg,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.lg,
  },
  previewBadge: {
    width: 54,
    height: 54,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewInputWrap: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  nameInput: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: SPACING.lg,
  },
  colorDot: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorDotActive: {
    borderWidth: 2,
    borderColor: COLORS.textPrimary,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SPACING.lg,
  },
  iconCell: {
    width: '14.5%',
    aspectRatio: 1,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.65,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },
});
