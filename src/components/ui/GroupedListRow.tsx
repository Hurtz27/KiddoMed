import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/tokens';

interface GroupedListRowProps {
  title: string;
  subtitle?: string;
  rightText?: string;
  rightTextColor?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconBg?: string;
  iconColor?: string;
  showDivider?: boolean;
  onPress?: () => void;
}

/**
 * Apple HIG Inset Grouped list row with optional colored icon badge and hairline divider.
 */
export function GroupedListRow({
  title,
  subtitle,
  rightText,
  rightTextColor,
  icon,
  iconBg = colors.primarySoft,
  iconColor = colors.primary,
  showDivider = true,
  onPress,
}: GroupedListRowProps) {
  const content = (
    <>
      <View style={styles.row}>
        {icon && (
          <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
            <Ionicons name={icon} size={18} color={iconColor} />
          </View>
        )}
        <View style={styles.center}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {rightText ? (
          <Text
            style={[
              styles.rightText,
              typography.tabularNums,
              rightTextColor ? { color: rightTextColor } : null,
            ]}
          >
            {rightText}
          </Text>
        ) : null}
      </View>
      {showDivider && <View style={[styles.divider, icon ? styles.dividerIndented : null]} />}
    </>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.7 }}>
        {content}
      </Pressable>
    );
  }

  return <View>{content}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
  },
  subtitle: {
    ...typography.footnote,
  },
  rightText: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  divider: {
    height: 0.5,
    backgroundColor: colors.border,
  },
  dividerIndented: {
    marginLeft: 34 + spacing.md,
  },
});
