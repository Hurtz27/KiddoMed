import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../../theme/tokens';

export type PillButtonVariant = 'primary' | 'danger' | 'tinted' | 'warningTinted';

interface PillButtonProps {
  label: string;
  onPress: () => void;
  variant?: PillButtonVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
}

const VARIANT_STYLES: Record<
  PillButtonVariant,
  { bg: string; text: string; iconColor: string }
> = {
  primary: {
    bg: colors.primary,
    text: colors.textInverse,
    iconColor: colors.textInverse,
  },
  danger: {
    bg: colors.danger,
    text: colors.textInverse,
    iconColor: colors.textInverse,
  },
  tinted: {
    bg: colors.primarySoft,
    text: colors.primary,
    iconColor: colors.primary,
  },
  warningTinted: {
    bg: colors.warningSoft,
    text: colors.warningText,
    iconColor: colors.warning,
  },
};

/**
 * Capsule-shaped CTA button following Apple HIG minimum touch target (48px) and haptic feedback.
 */
export function PillButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  style,
  haptic = true,
}: PillButtonProps) {
  const palette = VARIANT_STYLES[variant];

  const handlePress = () => {
    if (haptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: palette.bg },
        pressed && styles.pressed,
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={18} color={palette.iconColor} />}
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});
