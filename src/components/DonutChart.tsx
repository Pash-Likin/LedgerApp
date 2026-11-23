import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { COLORS, TABULAR_NUMS } from '../constants/theme';
import type { CategoryBreakdownItem } from '../types/ledger';
import { formatYuan } from '../utils/money';

interface DonutChartProps {
  items: CategoryBreakdownItem[];
  totalCents: number;
  centerTitle: string;
  selectedCategoryId: string | null;
  onSelectCategory?: (categoryId: string | null) => void;
  size?: number;
  strokeWidth?: number;
}

interface ComputedSlice {
  item: CategoryBreakdownItem;
  arcLength: number;
  offset: number;
}

export function DonutChart({
  items,
  totalCents,
  centerTitle,
  selectedCategoryId,
  onSelectCategory,
  size = 196,
  strokeWidth = 26,
}: DonutChartProps) {
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  const slices = useMemo<ComputedSlice[]>(() => {
    if (items.length === 0 || totalCents <= 0) {
      return [];
    }
    if (items.length === 1) {
      return [
        {
          item: items[0],
          arcLength: circumference,
          offset: 0,
        },
      ];
    }

    // Ensure tiny slices (<1%) still remain visible on the ring while keeping accurate total sum
    const minShare = 0.014;
    const rawShares = items.map((item) => Math.max(item.percentage / 100, minShare));
    const shareSum = rawShares.reduce((acc, v) => acc + v, 0);
    const gap = Math.min(2.5, circumference * 0.006);

    let accumulated = 0;
    return items.map((item, idx) => {
      const normalized = rawShares[idx] / shareSum;
      const fullLength = normalized * circumference;
      const visibleLength = Math.max(2, fullLength - gap);
      const slice: ComputedSlice = {
        item,
        arcLength: visibleLength,
        offset: -accumulated,
      };
      accumulated += fullLength;
      return slice;
    });
  }, [items, totalCents, circumference]);

  const activeItem = useMemo(
    () => items.find((i) => i.categoryId === selectedCategoryId) ?? null,
    [items, selectedCategoryId]
  );

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${center}, ${center}`}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={COLORS.divider}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {slices.map((slice) => {
            const isSelected = selectedCategoryId === slice.item.categoryId;
            const dimmed = selectedCategoryId !== null && !isSelected;
            return (
              <Circle
                key={slice.item.categoryId}
                cx={center}
                cy={center}
                r={radius}
                stroke={slice.item.categoryColor}
                strokeWidth={isSelected ? strokeWidth + 4 : strokeWidth}
                strokeOpacity={dimmed ? 0.3 : 1}
                strokeDasharray={`${slice.arcLength} ${circumference}`}
                strokeDashoffset={slice.offset}
                strokeLinecap="butt"
                fill="transparent"
                onPress={
                  onSelectCategory
                    ? () =>
                        onSelectCategory(
                          isSelected ? null : slice.item.categoryId
                        )
                    : undefined
                }
              />
            );
          })}
        </G>
      </Svg>

      <View style={styles.centerContent} pointerEvents="none">
        {items.length === 0 ? (
          <>
            <Text style={styles.emptyTitle}>暂无记录</Text>
            <Text style={styles.emptySub}>¥0.00</Text>
          </>
        ) : activeItem ? (
          <>
            <Text style={styles.centerLabel} numberOfLines={1}>
              {activeItem.categoryName} · {activeItem.percentage.toFixed(1)}%
            </Text>
            <Text style={styles.centerValue} numberOfLines={1} adjustsFontSizeToFit>
              ¥{formatYuan(activeItem.totalCents)}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.centerLabel}>{centerTitle}</Text>
            <Text style={styles.centerValue} numberOfLines={1} adjustsFontSizeToFit>
              ¥{formatYuan(totalCents)}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  centerContent: {
    position: 'absolute',
    width: '62%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  centerValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    fontVariant: [...TABULAR_NUMS],
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  emptySub: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '700',
    marginTop: 2,
    fontVariant: [...TABULAR_NUMS],
  },
});
