import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useKiddoMed } from '../context/KiddoMedContext';
import { colors, radius, spacing } from '../theme/tokens';

export function FamilySwitcherBar() {
  const router = useRouter();
  const { families, session, switchFamily } = useKiddoMed();

  if (families.length === 0) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rowContent}
      style={styles.row}
    >
      {families.map((f) => {
        const active = f.family_id === session?.family_id;
        return (
          <Pressable
            key={f.family_id}
            style={[styles.pill, active && styles.pillActive]}
            onPress={() => {
              if (active) return;
              Haptics.selectionAsync().catch(() => {});
              void switchFamily(f.family_id);
            }}
          >
            <Ionicons
              name={active ? 'home' : 'home-outline'}
              size={14}
              color={active ? colors.textInverse : colors.textSecondary}
            />
            <Text style={[styles.pillText, active && styles.pillTextActive]}>
              {f.family_name}
            </Text>
          </Pressable>
        );
      })}

      <Pressable
        style={styles.addPill}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          router.push('/modals/add-family');
        }}
      >
        <Ionicons name="add" size={15} color={colors.primary} />
        <Text style={styles.addPillText}>Otra familia</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: spacing.sm + 2,
    marginHorizontal: -spacing.lg,
  },
  rowContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  pillTextActive: {
    color: colors.textInverse,
  },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
  },
  addPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
});
