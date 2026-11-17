import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/tokens';

interface FormFieldProps extends TextInputProps {
  label: string;
  hint?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

/**
 * Apple HIG grouped form input with consistent label, subtle fill, and optional helper hint.
 */
export function FormField({
  label,
  hint,
  containerStyle,
  inputStyle,
  multiline,
  ...rest
}: FormFieldProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textTertiary}
        multiline={multiline}
        style={[styles.input, multiline && styles.multiline, inputStyle]}
        {...rest}
      />
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.subhead,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs + 2,
  },
  input: {
    minHeight: 46,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    color: colors.textPrimary,
  },
  multiline: {
    minHeight: 88,
    textAlignVertical: 'top',
    paddingTop: spacing.md,
  },
  hint: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
});
