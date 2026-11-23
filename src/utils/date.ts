const WEEKDAYS_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

export function pad2(n: number): string {
  return String(Math.trunc(n)).padStart(2, '0');
}

export function formatLocalDateTime(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
}

export function getCurrentYearMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
}

export function getTodayDateKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export function offsetDateKey(dateKey: string, deltaDays: number): string {
  const [yStr, mStr, dStr] = dateKey.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  const dt = new Date(y, m - 1, d + deltaDays);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

export function extractYearMonth(occurredAt: string): string {
  return occurredAt.slice(0, 7);
}

export function extractDateKey(occurredAt: string): string {
  return occurredAt.slice(0, 10);
}

export function extractTimeHHmm(occurredAt: string): string {
  return occurredAt.slice(11, 16);
}

export function shiftYearMonth(yearMonth: string, deltaMonths: number): string {
  const [yStr, mStr] = yearMonth.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const dt = new Date(y, m - 1 + deltaMonths, 1);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}`;
}

export function formatYearMonthLabel(yearMonth: string): string {
  const [yStr, mStr] = yearMonth.split('-');
  const m = Number(mStr);
  return `${yStr}年${m}月`;
}

export function formatDayHeaderLabel(dateKey: string): string {
  const [yStr, mStr, dStr] = dateKey.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  const dt = new Date(y, m - 1, d);
  const weekday = WEEKDAYS_ZH[dt.getDay()];
  return `${m}月${d}日 ${weekday}`;
}

export function getDaysInMonth(yearMonth: string): number {
  const [yStr, mStr] = yearMonth.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  return new Date(y, m, 0).getDate();
}

export function buildCalendarGrid(yearMonth: string): Array<number | null> {
  const [yStr, mStr] = yearMonth.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const firstWeekday = new Date(y, m - 1, 1).getDay(); // 0 = Sunday
  const totalDays = getDaysInMonth(yearMonth);

  const cells: Array<number | null> = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= totalDays; day += 1) {
    cells.push(day);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}
