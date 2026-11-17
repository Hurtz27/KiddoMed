import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/ui/Card';
import { ChipGroup, ChipOption } from '../components/ui/ChipGroup';
import { PillButton } from '../components/ui/PillButton';
import { useKiddoMed } from '../context/KiddoMedContext';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { formatDateOnly } from '../utils/formatting';

type StatusFilter = 'all' | 'active' | 'resolved';

const FILTER_OPTIONS: ChipOption<StatusFilter>[] = [
  { label: 'Todas', value: 'all' },
  { label: 'Activas', value: 'active' },
  { label: 'Resueltas', value: 'resolved' },
];

export default function MemberIllnessesScreen() {
  const { memberId } = useLocalSearchParams<{ memberId?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { members, illnesses, treatments, isCaregiver } = useKiddoMed();

  const [filter, setFilter] = useState<StatusFilter>('all');

  const member = members.find((m) => m.id === memberId);

  useEffect(() => {
    navigation.setOptions({
      title: member ? `Historial · ${member.display_name}` : 'Historial de Enfermedades',
    });
  }, [member, navigation]);

  const memberIllnesses = useMemo(() => {
    if (!memberId) return [];
    return illnesses.filter((ill) => {
      if (ill.member_id !== memberId) return false;
      if (filter === 'all') return true;
      return ill.status === filter;
    });
  }, [illnesses, memberId, filter]);

  if (!member) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>Miembro no encontrado</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topRow}>
        <ChipGroup options={FILTER_OPTIONS} value={filter} onChange={setFilter} />
        {isCaregiver && (
          <PillButton
            label="Nueva"
            icon="add"
            variant="tinted"
            onPress={() =>
              router.push({
                pathname: '/modals/add-illness',
                params: { memberId: member.id },
              })
            }
            style={styles.addBtn}
          />
        )}
      </View>

      {memberIllnesses.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Ionicons name="document-text-outline" size={32} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>Sin enfermedades registradas</Text>
          <Text style={styles.emptySub}>
            {filter === 'all'
              ? 'Este miembro aún no tiene enfermedades en su historial.'
              : 'No hay enfermedades con este filtro.'}
          </Text>
        </Card>
      ) : (
        memberIllnesses.map((ill) => {
          const trCount = treatments.filter((t) => t.illness_id === ill.id).length;

          return (
            <Pressable
              key={ill.id}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                router.push({
                  pathname: '/illness-detail',
                  params: { illnessId: ill.id },
                });
              }}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Card
                style={[styles.card, ill.status === 'resolved' && styles.cardResolved]}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.diagnosisText}>{ill.diagnosis}</Text>
                    <Text style={styles.doctorText}>
                      Dr./Dra. {ill.doctor_name} · {formatDateOnly(ill.diagnosed_at)}
                    </Text>
                  </View>
                  <View style={styles.rightCol}>
                    <View
                      style={[
                        styles.statusChip,
                        ill.status === 'resolved' && styles.statusChipResolved,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusChipText,
                          ill.status === 'resolved' && styles.statusChipTextResolved,
                        ]}
                      >
                        {ill.status === 'active' ? 'Activa' : 'Resuelta'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                  </View>
                </View>

                {ill.notes ? (
                  <Text style={styles.notesPreview} numberOfLines={2}>
                    {ill.notes}
                  </Text>
                ) : null}

                <View style={styles.footerRow}>
                  <Ionicons name="medical-outline" size={14} color={colors.textTertiary} />
                  <Text style={styles.footerText}>
                    {trCount === 0
                      ? 'Sin tratamientos registrados'
                      : `${trCount} tratamiento${trCount === 1 ? '' : 's'}`}
                  </Text>
                </View>
              </Card>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  addBtn: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  card: {
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  cardResolved: {
    opacity: 0.78,
  },
  pressed: {
    opacity: 0.85,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  diagnosisText: {
    ...typography.headline,
    fontSize: 16,
  },
  doctorText: {
    ...typography.footnote,
    ...typography.tabularNums,
    marginTop: 2,
  },
  statusChip: {
    backgroundColor: colors.warningSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusChipResolved: {
    backgroundColor: colors.successSoft,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.warningText,
  },
  statusChipTextResolved: {
    color: colors.successText,
  },
  notesPreview: {
    ...typography.subhead,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm + 2,
    paddingTop: spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
  },
  footerText: {
    ...typography.footnote,
    color: colors.textTertiary,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.xs + 2,
  },
  emptyTitle: {
    ...typography.headline,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  emptySub: {
    ...typography.subhead,
    textAlign: 'center',
    color: colors.textTertiary,
  },
});
