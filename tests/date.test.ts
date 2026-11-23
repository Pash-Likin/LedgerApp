import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCalendarGrid,
  extractDateKey,
  extractTimeHHmm,
  extractYearMonth,
  formatDayHeaderLabel,
  formatLocalDateTime,
  formatYearMonthLabel,
  getDaysInMonth,
  offsetDateKey,
  shiftYearMonth,
} from '../src/utils/date';

test('shiftYearMonth handles month and year boundaries cleanly', () => {
  assert.equal(shiftYearMonth('2026-01', -1), '2025-12');
  assert.equal(shiftYearMonth('2026-12', 1), '2027-01');
  assert.equal(shiftYearMonth('2026-11', -11), '2025-12');
});

test('getDaysInMonth respects leap years and standard months', () => {
  assert.equal(getDaysInMonth('2024-02'), 29);
  assert.equal(getDaysInMonth('2026-02'), 28);
  assert.equal(getDaysInMonth('2026-11'), 30);
  assert.equal(getDaysInMonth('2026-12'), 31);
});

test('offsetDateKey shifts days across month and year boundaries in local time', () => {
  assert.equal(offsetDateKey('2026-03-01', -1), '2026-02-28');
  assert.equal(offsetDateKey('2024-03-01', -1), '2024-02-29');
  assert.equal(offsetDateKey('2026-01-01', -2), '2025-12-30');
});

test('extract helpers and formatters return expected local date strings', () => {
  const local = formatLocalDateTime(new Date(2026, 10, 23, 9, 5, 7));
  assert.equal(local, '2026-11-23T09:05:07');
  assert.equal(extractYearMonth(local), '2026-11');
  assert.equal(extractDateKey(local), '2026-11-23');
  assert.equal(extractTimeHHmm(local), '09:05');
  assert.equal(formatYearMonthLabel('2026-11'), '2026年11月');
  assert.equal(formatDayHeaderLabel('2026-11-23'), '11月23日 周一');
});

test('buildCalendarGrid builds a Sunday-first 7-column grid', () => {
  // 2026-11-01 is Sunday (getDay() === 0) and November has 30 days -> 35 cells
  const novGrid = buildCalendarGrid('2026-11');
  assert.equal(novGrid.length % 7, 0);
  assert.equal(novGrid[0], 1);
  assert.equal(novGrid.filter((v) => v !== null).length, 30);

  // 2026-10-01 is Thursday (getDay() === 4) -> 4 leading nulls
  const octGrid = buildCalendarGrid('2026-10');
  assert.equal(octGrid.slice(0, 4).every((v) => v === null), true);
  assert.equal(octGrid[4], 1);
  assert.equal(octGrid.filter((v) => v !== null).length, 31);
});
