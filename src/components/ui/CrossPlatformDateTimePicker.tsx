import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { colors, radius } from '../../theme/tokens';

interface CrossPlatformDateTimePickerProps {
  value: Date;
  mode: 'date' | 'time';
  display?: 'default' | 'spinner' | 'calendar' | 'clock' | 'compact' | 'inline';
  maximumDate?: Date;
  onChange: (event: DateTimePickerEvent, date?: Date) => void;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toTimeInputValue(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Wrapper multiplataforma para DateTimePicker que renderiza un <input> HTML
 * nativo en Web/PWA y el selector nativo en iOS/Android.
 */
export function CrossPlatformDateTimePicker({
  value,
  mode,
  display,
  maximumDate,
  onChange,
}: CrossPlatformDateTimePickerProps) {
  if (Platform.OS !== 'web') {
    return (
      <DateTimePicker
        value={value}
        mode={mode}
        display={display}
        maximumDate={maximumDate}
        onChange={onChange}
      />
    );
  }

  const inputValue = mode === 'date' ? toDateInputValue(value) : toTimeInputValue(value);
  const maxAttr = mode === 'date' && maximumDate ? toDateInputValue(maximumDate) : undefined;

  const handleWebChange = (e: { target?: { value?: string } }) => {
    const raw = e?.target?.value;
    if (!raw) return;

    const next = new Date(value);
    if (mode === 'date') {
      const [y, m, d] = raw.split('-').map(Number);
      if (!y || !m || !d) return;
      next.setFullYear(y, m - 1, d);
    } else {
      const [hh, mm] = raw.split(':').map(Number);
      if (Number.isNaN(hh) || Number.isNaN(mm)) return;
      next.setHours(hh, mm, 0, 0);
    }
    onChange({ type: 'set', nativeEvent: { timestamp: next.getTime() } } as DateTimePickerEvent, next);
  };

  return (
    <View style={styles.webContainer}>
      {React.createElement('input', {
        type: mode,
        value: inputValue,
        max: maxAttr,
        onChange: handleWebChange,
        style: {
          width: '100%',
          padding: '10px 12px',
          fontSize: 15,
          borderRadius: radius.md,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.surface,
          color: colors.textPrimary,
          boxSizing: 'border-box',
        },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    marginTop: 8,
    marginBottom: 8,
  },
});
