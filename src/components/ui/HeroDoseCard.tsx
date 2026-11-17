import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadows, spacing, typography } from '../../theme/tokens';
import { TreatmentItem } from '../../types/database';
import { formatMinutesDiff, formatTimeShort } from '../../utils/formatting';
import { PillButton } from './PillButton';

interface HeroDoseCardProps {
  treatment: TreatmentItem | null;
  isCaregiver: boolean;
  onAdminister: (treatmentId: string) => void;
}

/**
 * Flo-inspired protagonist hero card showing either the most urgent upcoming dose or an all-clear summary.
 */
export function HeroDoseCard({
  treatment,
  isCaregiver,
  onAdminister,
}: HeroDoseCardProps) {
  if (!treatment) {
    return (
      <View style={[styles.card, styles.cardCalm]}>
        <View style={[styles.iconCircle, { backgroundColor: colors.surface }]}>
          <Ionicons name="checkmark-done" size={28} color={colors.success} />
        </View>
        <Text style={styles.calmTitle}>Todo al día</Text>
        <Text style={styles.calmSub}>
          No hay medicamentos programados pendientes en este momento.
        </Text>
      </View>
    );
  }

  const isPrn = treatment.frequency_type === 'prn';
  const countdown = treatment.next_due_at
    ? formatMinutesDiff(treatment.next_due_at)
    : {
        label: isPrn ? 'Disponible si requiere' : 'Pendiente 1ª toma',
        isOverdue: !isPrn,
      };

  const isDue = !isPrn && countdown.isOverdue;
  const isPrnSafe = isPrn && (!treatment.next_due_at || countdown.isOverdue);

  const cardBg = isDue
    ? colors.dangerSoft
    : isPrnSafe
    ? colors.successSoft
    : colors.primarySoft;

  const badgeText = isDue
    ? 'DOSIS PENDIENTE'
    : isPrnSafe
    ? 'DISPONIBLE SI REQUIERE'
    : 'PRÓXIMA TOMA';

  const badgeColor = isDue
    ? colors.dangerText
    : isPrnSafe
    ? colors.successText
    : colors.primary;

  const headlineTime =
    isPrn && treatment.next_due_at && !countdown.isOverdue
      ? `Esperar ${countdown.label.replace('En ', '')}`
      : isPrnSafe
      ? 'Lista si hay síntoma'
      : `${countdown.label}${treatment.next_due_at ? ` · ${formatTimeShort(treatment.next_due_at)}` : ''}`;

  return (
    <View style={[styles.card, { backgroundColor: cardBg }]}>
      <View style={styles.topRow}>
        <View style={styles.badgePill}>
          <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeText}</Text>
        </View>
        <Text style={styles.freqText}>{treatment.frequency_label}</Text>
      </View>

      <Text style={[styles.countdownHero, typography.tabularNums, { color: badgeColor }]}>
        {headlineTime}
      </Text>

      <Text style={styles.medTitle}>{treatment.brand_name}</Text>
      <Text style={styles.doseMeta}>
        Dosis: {treatment.dose_text}
        {treatment.active_ingredients ? ` · ${treatment.active_ingredients}` : ''}
      </Text>

      {isCaregiver && (
        <PillButton
          label="Marcar Administrada"
          icon="checkmark-circle"
          variant={isDue ? 'danger' : 'primary'}
          onPress={() => onAdminister(treatment.id)}
          style={styles.heroBtn}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: spacing.xl,
    ...shadows.card,
  },
  cardCalm: {
    backgroundColor: colors.successSoft,
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  calmTitle: {
    ...typography.title,
    fontSize: 22,
    color: colors.successText,
  },
  calmSub: {
    ...typography.subhead,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 19,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badgePill: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  freqText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  countdownHero: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: spacing.md,
  },
  medTitle: {
    ...typography.title,
    fontSize: 20,
    marginTop: spacing.xs,
  },
  doseMeta: {
    ...typography.subhead,
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: 3,
  },
  heroBtn: {
    marginTop: spacing.lg,
    width: '100%',
  },
});
