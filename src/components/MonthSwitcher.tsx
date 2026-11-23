import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS, RADIUS, SHADOW, SPACING, TABULAR_NUMS } from '../constants/theme';
import { triggerSelectionHaptic } from '../services/haptics';
import {
  formatYearMonthLabel,
  getCurrentYearMonth,
  pad2,
  shiftYearMonth,
} from '../utils/date';

interface MonthSwitcherProps {
  yearMonth: string;
  onChange: (nextYearMonth: string) => void;
  variant?: 'light' | 'dark';
}

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export function MonthSwitcher({
  yearMonth,
  onChange,
  variant = 'light',
}: MonthSwitcherProps) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerYear, setPickerYear] = useState<number>(() =>
    Number(yearMonth.split('-')[0])
  );

  useEffect(() => {
    setPickerYear(Number(yearMonth.split('-')[0]));
  }, [yearMonth]);

  const currentMonth = getCurrentYearMonth();
  const isDark = variant === 'dark';

  const handleShift = (delta: number) => {
    triggerSelectionHaptic();
    onChange(shiftYearMonth(yearMonth, delta));
  };

  const handleSelectMonth = (monthNum: number) => {
    triggerSelectionHaptic();
    onChange(`${pickerYear}-${pad2(monthNum)}`);
    setPickerVisible(false);
  };

  return (
    <>
      <View
        style={[
          styles.pill,
          isDark ? styles.pillDark : styles.pillLight,
        ]}
      >
        <TouchableOpacity
          onPress={() => handleShift(-1)}
          style={styles.arrowBtn}
          accessibilityLabel="上个月"
          hitSlop={8}
        >
          <Ionicons
            name="chevron-back"
            size={18}
            color={isDark ? COLORS.white : COLORS.textPrimary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setPickerYear(Number(yearMonth.split('-')[0]));
            setPickerVisible(true);
          }}
          style={styles.labelBtn}
          activeOpacity={0.7}
        >
          <Ionicons
            name="calendar-outline"
            size={15}
            color={isDark ? COLORS.primaryTint : COLORS.primary}
          />
          <Text
            style={[
              styles.labelText,
              isDark ? styles.labelTextDark : styles.labelTextLight,
            ]}
          >
            {formatYearMonthLabel(yearMonth)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleShift(1)}
          style={styles.arrowBtn}
          accessibilityLabel="下个月"
          hitSlop={8}
        >
          <Ionicons
            name="chevron-forward"
            size={18}
            color={isDark ? COLORS.white : COLORS.textPrimary}
          />
        </TouchableOpacity>
      </View>

      <Modal
        visible={pickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerVisible(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setPickerVisible(false)}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.yearHeader}>
              <TouchableOpacity
                onPress={() => setPickerYear((y) => y - 1)}
                style={styles.yearArrow}
              >
                <Ionicons name="chevron-back" size={20} color={COLORS.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.yearTitle}>{pickerYear} 年</Text>
              <TouchableOpacity
                onPress={() => setPickerYear((y) => y + 1)}
                style={styles.yearArrow}
              >
                <Ionicons name="chevron-forward" size={20} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.monthGrid}>
              {MONTHS.map((m) => {
                const candidate = `${pickerYear}-${pad2(m)}`;
                const isSelected = candidate === yearMonth;
                const isCurrent = candidate === currentMonth;
                return (
                  <TouchableOpacity
                    key={m}
                    onPress={() => handleSelectMonth(m)}
                    style={[
                      styles.monthCell,
                      isSelected && styles.monthCellSelected,
                      !isSelected && isCurrent && styles.monthCellCurrent,
                    ]}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.monthCellText,
                        isSelected && styles.monthCellTextSelected,
                        !isSelected && isCurrent && styles.monthCellTextCurrent,
                      ]}
                    >
                      {m}月
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={() => {
                  triggerSelectionHaptic();
                  onChange(currentMonth);
                  setPickerVisible(false);
                }}
                style={styles.todayBtn}
              >
                <Text style={styles.todayBtnText}>回到本月</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setPickerVisible(false)}
                style={styles.closeBtn}
              >
                <Text style={styles.closeBtnText}>关闭</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 4,
  },
  pillLight: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pillDark: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  arrowBtn: {
    padding: 6,
    borderRadius: RADIUS.pill,
  },
  labelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  labelText: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: [...TABULAR_NUMS],
  },
  labelTextLight: {
    color: COLORS.textPrimary,
  },
  labelTextDark: {
    color: COLORS.white,
  },
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOW.card,
  },
  yearHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  yearArrow: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  yearTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    fontVariant: [...TABULAR_NUMS],
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  monthCell: {
    width: '23%',
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCellSelected: {
    backgroundColor: COLORS.primary,
  },
  monthCellCurrent: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryTint,
  },
  monthCellText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  monthCellTextSelected: {
    color: COLORS.white,
  },
  monthCellTextCurrent: {
    color: COLORS.primary,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  todayBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primarySoft,
  },
  todayBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  closeBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
});
