import type { TransactionType } from '../types/ledger';

const MAX_AMOUNT_CENTS = 9_999_999_999; // 99,999,999.99 yuan

export function formatYuan(
  cents: number,
  options?: { withCommas?: boolean }
): string {
  const withCommas = options?.withCommas ?? true;
  const rounded = Math.round(cents);
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded);
  const fixed = (abs / 100).toFixed(2);
  if (!withCommas) {
    return `${sign}${fixed}`;
  }
  const [intPart, decPart] = fixed.split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${formattedInt}.${decPart}`;
}

export function formatSignedYuan(cents: number, type: TransactionType): string {
  const prefix = type === 'expense' ? '-¥' : '+¥';
  return `${prefix}${formatYuan(Math.abs(cents))}`;
}

export function parseYuanToCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(trimmed)) {
    return null;
  }
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  const cents = Math.round(numeric * 100);
  if (cents <= 0 || cents > MAX_AMOUNT_CENTS) {
    return null;
  }
  return cents;
}

/**
 * Safely evaluates a simple + / - keypad expression (e.g. "28.5+12-4.5")
 * in integer cents without using eval().
 * Handles a trailing operator (e.g. "28.5+") by ignoring it for live preview.
 * Returns null if syntax is invalid or evaluated value is <= 0.
 */
export function evaluateKeypadToCents(expr: string): number | null {
  let cleaned = expr.replace(/\s+/g, '');
  if (!cleaned) {
    return null;
  }

  // Strip a single trailing operator so live preview remains helpful while typing
  if (cleaned.endsWith('+') || cleaned.endsWith('-')) {
    cleaned = cleaned.slice(0, -1);
  }
  if (!cleaned) {
    return null;
  }

  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[+-](?:\d+(?:\.\d*)?|\.\d+))*$/.test(cleaned)) {
    return null;
  }

  const tokens = cleaned.match(/[+-]?(?:\d+(?:\.\d*)?|\.\d+)/g);
  if (!tokens || tokens.length === 0) {
    return null;
  }

  let totalCents = 0;
  for (const token of tokens) {
    const sign = token.startsWith('-') ? -1 : 1;
    const unsigned = token.startsWith('+') || token.startsWith('-') ? token.slice(1) : token;
    // Allow up to 2 decimal digits per term; trailing dot like "10." parses as 10
    const normalized = unsigned.endsWith('.') ? unsigned.slice(0, -1) : unsigned;
    if (!normalized) {
      return null;
    }
    const dotIndex = normalized.indexOf('.');
    if (dotIndex !== -1 && normalized.length - dotIndex - 1 > 2) {
      return null;
    }
    const num = Number(normalized);
    if (!Number.isFinite(num)) {
      return null;
    }
    totalCents += sign * Math.round(num * 100);
  }

  if (!Number.isFinite(totalCents) || totalCents <= 0 || totalCents > MAX_AMOUNT_CENTS) {
    return null;
  }
  return totalCents;
}

export function evaluateKeypadExpression(expr: string): number | null {
  const cents = evaluateKeypadToCents(expr);
  if (cents === null) {
    return null;
  }
  return cents / 100;
}
