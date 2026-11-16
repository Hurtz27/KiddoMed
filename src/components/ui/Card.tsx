import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, shadows, spacing } from '../../theme/tokens';

export type CardVariant = 'default' | 'muted' | 'urgent';

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  style?: StyleProp<ViewStyle>;
}

/**
 * Apple HIG grouped card container with subtle elevation and rounded corners.
 */
export function Card({ children, variant = 'default', style }: CardProps) {
  return (
    <View
      style={[
        styles.base,
        variant === 'default' && styles.defaultCard,
        variant === 'muted' && styles.mutedCard,
        variant === 'urgent' && styles.urgentCard,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  defaultCard: {
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  mutedCard: {
    backgroundColor: colors.surfaceMuted,
  },
  urgentCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.dangerBorder,
    ...shadows.card,
  },
});
