import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/tokens';

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

interface WeekStripProps {
  selectedDateKey: string;
  onSelectDateKey: (dateKey: string) => void;
  activityDateKeys: Set<string>;
  accentColor?: string;
}

/**
 * Flo-style 7-day horizontal calendar strip (Mon-Sun) with activity dots and haptic selection.
 */
export function WeekStrip({
  selectedDateKey,
  onSelectDateKey,
  activityDateKeys,
  accentColor = colors.primary,
}: WeekStripProps) {
  const todayKey = toDateKey(new Date());
  const [weekOffset, setWeekOffset] = useState(0);

  const { weekDays, headerLabel } = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun..6=Sat
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + mondayOffset + weekOffset * 7
    );

    const days = Array.from({ length: 7 }, (_, idx) => {
      const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + idx);
      return {
        label: DAY_LABELS[idx],
        dayNumber: date.getDate(),
        key: toDateKey(date),
      };
    });

    const rawMonth = monday.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    const label = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1);

    return { weekDays: days, headerLabel: label };
  }, [weekOffset]);

  const handleStepWeek = (delta: number) => {
    Haptics.selectionAsync().catch(() => {});
    setWeekOffset((prev) => Math.min(0, prev + delta));
  };

  const handleJumpToday = () => {
    Haptics.selectionAsync().catch(() => {});
    setWeekOffset(0);
    onSelectDateKey(todayKey);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.monthLabel}>{headerLabel}</Text>
        <View style={styles.navCluster}>
          {(weekOffset !== 0 || selectedDateKey !== todayKey) && (
            <Pressable
              style={[styles.todayPill, { backgroundColor: `${accentColor}18` }]}
              onPress={handleJumpToday}
              hitSlop={6}
            >
              <Text style={[styles.todayPillText, { color: accentColor }]}>Hoy</Text>
            </Pressable>
          )}
          <Pressable
            style={styles.navBtn}
            onPress={() => handleStepWeek(-1)}
            hitSlop={8}
            accessibilityLabel="Semana anterior"
          >
            <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            style={[styles.navBtn, weekOffset >= 0 && styles.navBtnDisabled]}
            onPress={() => handleStepWeek(1)}
            disabled={weekOffset >= 0}
            hitSlop={8}
            accessibilityLabel="Semana siguiente"
          >
            <Ionicons
              name="chevron-forward"
              size={18}
              color={weekOffset >= 0 ? colors.textTertiary : colors.textSecondary}
            />
          </Pressable>
        </View>
      </View>

      <View style={styles.daysRow}>
        {weekDays.map((day) => {
          const isSelected = day.key === selectedDateKey;
          const isToday = day.key === todayKey;
          const hasActivity = activityDateKeys.has(day.key);

          return (
            <Pressable
              key={day.key}
              style={styles.dayCol}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onSelectDateKey(day.key);
              }}
            >
              <Text style={[styles.dayLabel, isToday && { color: accentColor, fontWeight: '700' }]}>
                {day.label}
              </Text>
              <View
                style={[
                  styles.circle,
                  isToday && !isSelected && { borderWidth: 1.5, borderColor: accentColor },
                  isSelected && { backgroundColor: accentColor },
                ]}
              >
                <Text
                  style={[
                    styles.dayNumber,
                    typography.tabularNums,
                    isToday && !isSelected && { color: accentColor },
                    isSelected && styles.dayNumberSelected,
                  ]}
                >
                  {day.dayNumber}
                </Text>
              </View>
              <View
                style={[
                  styles.dot,
                  hasActivity && {
                    backgroundColor: isSelected ? accentColor : colors.textTertiary,
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  monthLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  navCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  todayPill: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginRight: spacing.xs,
  },
  todayPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  navBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  circle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  dayNumberSelected: {
    color: colors.textInverse,
    fontWeight: '700',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'transparent',
  },
});
