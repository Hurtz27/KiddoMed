import { Platform, ViewStyle } from 'react-native';

export const colors = {
  // Apple HIG Grouped Surfaces
  background: '#F2F2F7',
  surface: '#FFFFFF',
  surfaceMuted: '#EFEFF4',
  surfaceTinted: '#EBF5FF',

  // Typography
  textPrimary: '#1C1C1E',
  textSecondary: '#636366',
  textTertiary: '#8E8E93',
  textInverse: '#FFFFFF',

  // Hairline Separators & Borders
  border: '#E5E5EA',
  borderSubtle: '#F2F2F7',

  // Brand & Semantic (Apple System Colors)
  primary: '#007AFF',
  primarySoft: '#EBF5FF',

  success: '#34C759',
  successText: '#15803D',
  successSoft: '#EAFBF0',

  warning: '#FF9500',
  warningText: '#B45309',
  warningSoft: '#FFF4E5',

  danger: '#FF3B30',
  dangerText: '#C81E1E',
  dangerSoft: '#FFEBEA',
  dangerBorder: '#FFC5C2',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 999,
} as const;

export const typography = {
  largeTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
  headline: {
    fontSize: 16,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
    color: colors.textPrimary,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: colors.textPrimary,
  },
  subhead: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: colors.textSecondary,
  },
  footnote: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: colors.textSecondary,
  },
  caption: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: colors.textTertiary,
  },
  tabularNums: {
    fontVariant: ['tabular-nums'] as ('tabular-nums')[],
  },
} as const;

export const shadows: Record<'card' | 'pill', ViewStyle> = {
  card: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOpacity: 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
    },
    android: {
      elevation: 2,
    },
    default: {
      shadowColor: '#000000',
      shadowOpacity: 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
    },
  }) as ViewStyle,
  pill: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOpacity: 0.04,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    android: {
      elevation: 1,
    },
    default: {},
  }) as ViewStyle,
};

export const MEMBER_COLOR_PALETTE = [
  '#0284C7', // Azul cielo
  '#0D9488', // Verde azulado
  '#7C3AED', // Morado
  '#DB2777', // Rosa
  '#EA580C', // Naranja
  '#16A34A', // Verde
  '#4F46E5', // Índigo
  '#E11D48', // Rojo coral
  '#D97706', // Ámbar
  '#0891B2', // Cian
  '#65A30D', // Lima oscuro
  '#9333EA', // Ciruela
] as const;

export function getFirstAvailableMemberColor(usedColors: Iterable<string>): string {
  const used = new Set(Array.from(usedColors, (c) => c.toUpperCase()));
  return (
    MEMBER_COLOR_PALETTE.find((c) => !used.has(c.toUpperCase())) ?? MEMBER_COLOR_PALETTE[0]
  );
}
