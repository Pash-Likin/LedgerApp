export const COLORS = {
  bg: '#F5F7FA',
  surface: '#FFFFFF',
  surfaceAlt: '#F8FAFC',
  border: '#EAEEF4',
  divider: '#F1F5F9',
  primary: '#0F766E',
  primaryDark: '#115E59',
  primarySoft: '#F0FDFA',
  primaryTint: '#CCFBF1',
  expense: '#E11D48',
  expenseSoft: '#FFF1F2',
  income: '#059669',
  incomeSoft: '#ECFDF5',
  warning: '#D97706',
  warningSoft: '#FEF3C7',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  white: '#FFFFFF',
  overlay: 'rgba(15, 23, 42, 0.45)',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const SHADOW = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  floating: {
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
} as const;

export const TABULAR_NUMS = ['tabular-nums'] as const;
