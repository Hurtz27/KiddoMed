import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../../theme/tokens';

export type BannerTone = 'info' | 'danger' | 'warning';

interface StatusBannerProps {
  message: string;
  tone?: BannerTone;
  icon: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}

const TONE_MAP: Record<BannerTone, { bg: string; text: string; icon: string }> = {
  info: {
    bg: colors.primarySoft,
    text: colors.primary,
    icon: colors.primary,
  },
  danger: {
    bg: colors.dangerSoft,
    text: colors.dangerText,
    icon: colors.danger,
  },
  warning: {
    bg: colors.warningSoft,
    text: colors.warningText,
    icon: colors.warning,
  },
};

/**
 * Compact Apple-style inset status banner for offline, read-only, or allergy alerts.
 */
export function StatusBanner({ message, tone = 'info', icon, style }: StatusBannerProps) {
  const palette = TONE_MAP[tone];
  return (
    <View style={[styles.base, { backgroundColor: palette.bg }, style]}>
      <Ionicons name={icon} size={18} color={palette.icon} />
      <Text style={[styles.text, { color: palette.text }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
});
