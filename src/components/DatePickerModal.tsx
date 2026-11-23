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
  buildCalendarGrid,
  formatYearMonthLabel,
  getTodayDateKey,
  pad2,
  shiftYearMonth,
} from '../utils/date';

interface DatePickerModalProps {
  visible: boolean;
  selectedDateKey: string;
  onSelect: (dateKey: string) => void;
  onClose: () => void;
}

const WEEK_HEADERS = ['日', '一', '二', '三', '四', '五', '六'] as const;

export function DatePickerModal({
  visible,
  selectedDateKey,
  onSelect,
  onClose,
}: DatePickerModalProps) {
  const [viewMonth, setViewMonth] = useState<string>(() =>
    selectedDateKey.slice(0, 7)
  );

  useEffect(() => {
    if (visible && selectedDateKey) {
      setViewMonth(selectedDateKey.slice(0, 7));
    }
  }, [visible, selectedDateKey]);

  const todayKey = getTodayDateKey();
  const grid = buildCalendarGrid(viewMonth);

  const handleSelectDay = (day: number) => {
    triggerSelectionHaptic();
    onSelect(`${viewMonth}-${pad2(day)}`);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => setViewMonth((m) => shiftYearMonth(m, -1))}
              style={styles.navBtn}
            >
              <Ionicons name="chevron-back" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>
              {formatYearMonthLabel(viewMonth)}
            </Text>
            <TouchableOpacity
              onPress={() => setViewMonth((m) => shiftYearMonth(m, 1))}
              style={styles.navBtn}
            >
              <Ionicons name="chevron-forward" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekRow}>
            {WEEK_HEADERS.map((w) => (
              <Text key={w} style={styles.weekText}>
                {w}
              </Text>
            ))}
          </View>

          <View style={styles.daysGrid}>
            {grid.map((day, idx) => {
              if (day === null) {
                return <View key={`empty_${idx}`} style={styles.dayCell} />;
              }
              const dateKey = `${viewMonth}-${pad2(day)}`;
              const isSelected = dateKey === selectedDateKey;
              const isToday = dateKey === todayKey;

              return (
                <TouchableOpacity
                  key={dateKey}
                  style={[
                    styles.dayCell,
                    isSelected && styles.dayCellSelected,
                    !isSelected && isToday && styles.dayCellToday,
                  ]}
                  onPress={() => handleSelectDay(day)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isSelected && styles.dayTextSelected,
                      !isSelected && isToday && styles.dayTextToday,
                    ]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              onPress={() => {
                triggerSelectionHaptic();
                onSelect(todayKey);
                onClose();
              }}
              style={styles.todayBtn}
            >
              <Text style={styles.todayBtnText}>选择今天</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>取消</Text>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  card: {
    width: '100%',
    maxWidth: 350,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOW.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    fontVariant: [...TABULAR_NUMS],
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: SPACING.xs,
  },
  weekText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    paddingVertical: 4,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.285%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.pill,
  },
  dayCellSelected: {
    backgroundColor: COLORS.primary,
  },
  dayCellToday: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryTint,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    fontVariant: [...TABULAR_NUMS],
  },
  dayTextSelected: {
    color: COLORS.white,
  },
  dayTextToday: {
    color: COLORS.primary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  todayBtn: {
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
  },
  todayBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  cancelBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
});
