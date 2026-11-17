import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../../theme/tokens';

export interface ChipOption<T extends string> {
  label: string;
  value: T;
}

interface SingleChipGroupProps<T extends string> {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  multi?: false;
  style?: StyleProp<ViewStyle>;
}

interface MultiChipGroupProps<T extends string> {
  options: ChipOption<T>[];
  value: T[];
  onChange: (value: T[]) => void;
  multi: true;
  style?: StyleProp<ViewStyle>;
}

type ChipGroupProps<T extends string> = SingleChipGroupProps<T> | MultiChipGroupProps<T>;

/**
 * Pill-shaped selectable chips with haptic feedback for single or multi-select options.
 */
export function ChipGroup<T extends string>(props: ChipGroupProps<T>) {
  const { options, style } = props;

  const isSelected = (val: T) =>
    props.multi ? props.value.includes(val) : props.value === val;

  const handlePress = (val: T) => {
    Haptics.selectionAsync().catch(() => {});
    if (props.multi) {
      const next = props.value.includes(val)
        ? props.value.filter((item) => item !== val)
        : [...props.value, val];
      props.onChange(next);
    } else {
      props.onChange(val);
    }
  };

  return (
    <View style={[styles.row, style]}>
      {options.map((opt) => {
        const active = isSelected(opt.value);
        return (
          <Pressable
            key={opt.value}
            onPress={() => handlePress(opt.value)}
            style={({ pressed }) => [
              styles.chip,
              active && styles.chipActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm + 1,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  pressed: {
    opacity: 0.78,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.primary,
  },
});
