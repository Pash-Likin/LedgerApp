import React, { useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { COLORS, RADIUS, SPACING, TABULAR_NUMS } from '../constants/theme';
import { triggerSelectionHaptic } from '../services/haptics';
import type { DailyTotalItem, TransactionType } from '../types/ledger';
import { formatYuan } from '../utils/money';

interface DailyBarChartProps {
  items: DailyTotalItem[];
  type: TransactionType;
  height?: number;
}

export function DailyBarChart({
  items,
  type,
  height = 136,
}: DailyBarChartProps) {
  const [chartWidth, setChartWidth] = useState(300);
  const [activeDay, setActiveDay] = useState<number | null>(null);

  const barColor = type === 'expense' ? COLORS.expense : COLORS.income;
  const activeBg = type === 'expense' ? COLORS.expenseSoft : COLORS.incomeSoft;

  const { maxCents, values } = useMemo(() => {
    const vals = items.map((d) =>
      type === 'expense' ? d.expenseCents : d.incomeCents
    );
    const maxVal = vals.reduce((m, v) => Math.max(m, v), 0);
    return { maxCents: maxVal, values: vals };
  }, [items, type]);

  const activeItem = useMemo(() => {
    if (activeDay === null) return null;
    return items.find((d) => d.day === activeDay) ?? null;
  }, [activeDay, items]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - chartWidth) > 1) {
      setChartWidth(w);
    }
  };

  const count = items.length || 30;
  const plotHeight = height - 12;
  const slotWidth = chartWidth / count;
  const barWidth = Math.max(3, Math.min(9, slotWidth * 0.62));

  const ticks = useMemo(() => {
    const last = items.length;
    const base = [1, 5, 10, 15, 20, 25];
    if (last > 27) {
      base.push(last);
    }
    return base.filter((d) => d <= last);
  }, [items.length]);

  return (
    <View>
      <View style={styles.tooltipBar}>
        {activeItem ? (
          <View style={[styles.tooltipBadge, { backgroundColor: activeBg }]}>
            <Text style={[styles.tooltipText, { color: barColor }]}>
              {activeItem.day}日 · ¥
              {formatYuan(
                type === 'expense'
                  ? activeItem.expenseCents
                  : activeItem.incomeCents
              )}
            </Text>
          </View>
        ) : (
          <Text style={styles.hintText}>点击柱状条可查看单日明细</Text>
        )}
      </View>

      <View style={[styles.chartContainer, { height }]} onLayout={handleLayout}>
        <Svg width={chartWidth} height={height}>
          <Line
            x1={0}
            y1={plotHeight * 0.25}
            x2={chartWidth}
            y2={plotHeight * 0.25}
            stroke={COLORS.divider}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <Line
            x1={0}
            y1={plotHeight * 0.6}
            x2={chartWidth}
            y2={plotHeight * 0.6}
            stroke={COLORS.divider}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <Line
            x1={0}
            y1={plotHeight}
            x2={chartWidth}
            y2={plotHeight}
            stroke={COLORS.border}
            strokeWidth={1}
          />

          {items.map((item, idx) => {
            const cents = values[idx] ?? 0;
            const x = idx * slotWidth + (slotWidth - barWidth) / 2;
            const rawBarHeight =
              maxCents > 0 ? (cents / maxCents) * (plotHeight - 8) : 0;
            const barH = cents > 0 ? Math.max(4, rawBarHeight) : 2;
            const y = plotHeight - barH;
            const isSelected = activeDay === item.day;
            const fill =
              cents === 0
                ? COLORS.divider
                : activeDay === null || isSelected
                ? barColor
                : `${barColor}55`;

            return (
              <Rect
                key={item.dateKey}
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx={2}
                ry={2}
                fill={fill}
              />
            );
          })}
        </Svg>

        <View style={styles.touchLayer}>
          {items.map((item) => (
            <Pressable
              key={item.dateKey}
              style={styles.touchSlot}
              onPress={() => {
                triggerSelectionHaptic();
                setActiveDay((prev) => (prev === item.day ? null : item.day));
              }}
              accessibilityLabel={`${item.day}日`}
            />
          ))}
        </View>
      </View>

      <View style={styles.axisRow}>
        {ticks.map((dayTick) => (
          <Text key={dayTick} style={styles.axisLabel}>
            {dayTick}日
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tooltipBar: {
    height: 24,
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginBottom: SPACING.xs,
  },
  tooltipBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
  },
  tooltipText: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: [...TABULAR_NUMS],
  },
  hintText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  chartContainer: {
    position: 'relative',
    width: '100%',
  },
  touchLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
  },
  touchSlot: {
    flex: 1,
    height: '100%',
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  axisLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontVariant: [...TABULAR_NUMS],
  },
});
