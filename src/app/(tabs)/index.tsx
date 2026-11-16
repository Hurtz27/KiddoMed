import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/ui/Card';
import { PillButton } from '../../components/ui/PillButton';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { useKiddoMed } from '../../context/KiddoMedContext';
import { colors, radius, shadows, spacing, typography } from '../../theme/tokens';
import {
  formatDateTimeShort,
  formatMinutesDiff,
  formatTimeShort,
  getRelationshipLabel,
  getTemperatureColor,
} from '../../utils/formatting';

type PastNode =
  | {
      kind: 'dose';
      id: string;
      time: string;
      title: string;
      subtitle: string;
      by: string;
      notes: string | null;
    }
  | {
      kind: 'symptom';
      id: string;
      time: string;
      title: string;
      color: string;
      by: string;
      notes: string | null;
    };

export default function TimelineDashboardScreen() {
  const router = useRouter();
  const {
    isCaregiver,
    isOffline,
    members,
    illnesses,
    treatments,
    doseLogs,
    symptomLogs,
    selectedMemberId,
    setSelectedMemberId,
  } = useKiddoMed();

  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const activeMember = members.find((m) => m.id === selectedMemberId) ?? members[0] ?? null;

  const activeTreatments = useMemo(() => {
    if (!activeMember) return [];
    const activeIllnessIds = new Set(
      illnesses
        .filter((i) => i.member_id === activeMember.id && i.status === 'active')
        .map((i) => i.id)
    );
    return treatments.filter(
      (t) =>
        t.member_id === activeMember.id &&
        t.status === 'active' &&
        activeIllnessIds.has(t.illness_id)
    );
  }, [activeMember, illnesses, treatments]);

  const pastNodes = useMemo<PastNode[]>(() => {
    if (!activeMember) return [];
    const trMap = new Map(treatments.map((t) => [t.id, t]));

    const dNodes: PastNode[] = doseLogs
      .filter((d) => d.member_id === activeMember.id)
      .slice(0, 15)
      .map((d) => {
        const tr = trMap.get(d.treatment_item_id);
        const title = tr
          ? `${tr.brand_name}${tr.active_ingredients ? ` (${tr.active_ingredients})` : ''}`
          : 'Tratamiento';
        return {
          kind: 'dose',
          id: `d-${d.id}`,
          time: d.administered_at,
          title,
          subtitle: `Administrada: ${d.dose_text}`,
          by: d.administered_by_member_name,
          notes: d.notes,
        };
      });

    const sNodes: PastNode[] = symptomLogs
      .filter((s) => s.member_id === activeMember.id)
      .slice(0, 10)
      .map((s) => ({
        kind: 'symptom',
        id: `s-${s.id}`,
        time: s.recorded_at,
        title:
          s.temperature_celsius !== null
            ? `Temperatura: ${s.temperature_celsius.toFixed(1)} °C`
            : `Síntomas: ${s.symptoms.join(', ')}`,
        color: getTemperatureColor(s.temperature_celsius),
        by: s.recorded_by_name,
        notes: s.notes,
      }));

    // Orden cronológico ascendente para leer de arriba (pasado) hacia AHORA
    return [...dNodes, ...sNodes]
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
      .slice(-8);
  }, [activeMember, treatments, doseLogs, symptomLogs]);

  const upcomingTreatments = useMemo(() => {
    return [...activeTreatments].sort((a, b) => {
      if (a.frequency_type === 'prn' && b.frequency_type !== 'prn') return 1;
      if (a.frequency_type !== 'prn' && b.frequency_type === 'prn') return -1;
      const aMs = a.next_due_at ? new Date(a.next_due_at).getTime() : 0;
      const bMs = b.next_due_at ? new Date(b.next_due_at).getTime() : 0;
      return aMs - bMs;
    });
  }, [activeTreatments]);

  const handleSelectMember = (memberId: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedMemberId(memberId);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {isOffline && (
        <StatusBanner
          tone="danger"
          icon="cloud-offline"
          message="Sin conexión: viendo caché local. Conéctate para registrar tomas."
          style={styles.bannerSpacing}
        />
      )}

      {!isCaregiver && (
        <StatusBanner
          tone="info"
          icon="eye-outline"
          message="Modo Paciente (Solo visualización): solo los cuidadores pueden marcar dosis."
          style={styles.bannerSpacing}
        />
      )}

      {/* Selector horizontal de Miembros estilo Apple/Flo */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.memberRowContent}
        style={styles.memberRow}
      >
        {members.map((m) => {
          const selected = m.id === activeMember?.id;
          const activeColor = m.accent_color || colors.primary;
          return (
            <Pressable
              key={m.id}
              style={[
                styles.memberPill,
                selected && { backgroundColor: activeColor, borderColor: 'transparent' },
              ]}
              onPress={() => handleSelectMember(m.id)}
            >
              <Text style={[styles.memberPillText, selected && styles.memberPillTextSelected]}>
                {m.display_name}
              </Text>
              <Text
                style={[styles.memberRoleText, selected && styles.memberRoleTextSelected]}
              >
                {getRelationshipLabel(m.relationship)}
              </Text>
            </Pressable>
          );
        })}

        {isCaregiver && (
          <Pressable
            style={styles.addMemberPill}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              router.push('/modals/add-member');
            }}
          >
            <Ionicons name="add" size={18} color={colors.primary} />
            <Text style={styles.addMemberText}>Miembro</Text>
          </Pressable>
        )}
      </ScrollView>

      {activeMember && (
        <>
          {/* Encabezado Large Title */}
          <View style={styles.heroHeader}>
            <Text style={typography.largeTitle}>{activeMember.display_name}</Text>
            <Text style={typography.subhead}>
              {getRelationshipLabel(activeMember.relationship)} · Resumen de hoy
            </Text>
          </View>

          {activeMember.allergies.length > 0 && (
            <StatusBanner
              tone="danger"
              icon="alert-circle"
              message={`Alergias: ${activeMember.allergies.join(', ')}`}
              style={styles.bannerSpacing}
            />
          )}

          {isCaregiver && (
            <View style={styles.quickActions}>
              <PillButton
                label="Enfermedad"
                icon="medkit-outline"
                variant="tinted"
                style={styles.quickActionBtn}
                onPress={() =>
                  router.push({
                    pathname: '/modals/add-illness',
                    params: { memberId: activeMember.id },
                  })
                }
              />
              <PillButton
                label="Fiebre / Síntoma"
                icon="thermometer-outline"
                variant="warningTinted"
                style={styles.quickActionBtn}
                onPress={() =>
                  router.push({
                    pathname: '/modals/add-symptom',
                    params: { memberId: activeMember.id },
                  })
                }
              />
            </View>
          )}

          {/* LÍNEA DEL TIEMPO VERTICAL */}
          <Text style={styles.sectionTitle}>Línea del Tiempo</Text>

          {pastNodes.length === 0 && upcomingTreatments.length === 0 ? (
            <Card style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="medical-outline" size={28} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Sin tratamientos activos</Text>
              <Text style={styles.emptySub}>
                {isCaregiver
                  ? 'Registra una enfermedad y sus tratamientos para ver las próximas tomas aquí.'
                  : 'No hay tratamientos activos registrados para este miembro.'}
              </Text>
            </Card>
          ) : (
            <View style={styles.timelineWrap}>
              {/* NODOS PASADOS */}
              {pastNodes.map((node) => (
                <View key={node.id} style={styles.timelineRow}>
                  <View style={styles.railCol}>
                    <View
                      style={[
                        styles.dotPast,
                        node.kind === 'symptom' && { backgroundColor: node.color },
                      ]}
                    />
                    <View style={styles.railLine} />
                  </View>
                  <Card variant="muted" style={styles.pastCard}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.pastTime}>{formatDateTimeShort(node.time)}</Text>
                      <Text style={styles.pastBy}>por {node.by}</Text>
                    </View>
                    <Text
                      style={[
                        styles.pastTitle,
                        node.kind === 'symptom' && { color: node.color },
                      ]}
                    >
                      {node.title}
                    </Text>
                    {node.kind === 'dose' && (
                      <Text style={styles.pastSub}>{node.subtitle}</Text>
                    )}
                    {node.notes && <Text style={styles.noteText}>Nota: {node.notes}</Text>}
                  </Card>
                </View>
              ))}

              {/* MARCADOR CENTRAL "AHORA" */}
              <View style={styles.nowRow}>
                <View style={styles.nowBadge}>
                  <Text style={styles.nowText}>
                    AHORA · {formatTimeShort(new Date().toISOString())}
                  </Text>
                </View>
                <View style={styles.nowLine} />
              </View>

              {/* PRÓXIMAS APLICACIONES */}
              {upcomingTreatments.map((tr) => {
                const isPrn = tr.frequency_type === 'prn';
                const countdown = tr.next_due_at
                  ? formatMinutesDiff(tr.next_due_at)
                  : {
                      label: isPrn ? 'Disponible si requiere' : 'Pendiente 1ª toma',
                      isOverdue: !isPrn,
                    };

                const isDue = !isPrn && countdown.isOverdue;
                const isPrnSafe = isPrn && (!tr.next_due_at || countdown.isOverdue);

                const statusLabel =
                  isPrn && tr.next_due_at && !countdown.isOverdue
                    ? `Esperar (${countdown.label.replace('En ', '')})`
                    : isPrnSafe
                    ? 'Disponible si hay síntoma'
                    : `${countdown.label}${tr.next_due_at ? ` · ${formatTimeShort(tr.next_due_at)}` : ''}`;

                return (
                  <View key={tr.id} style={styles.timelineRow}>
                    <View style={styles.railCol}>
                      <View
                        style={[
                          styles.dotFuture,
                          isDue && styles.dotUrgent,
                          isPrnSafe && styles.dotSafe,
                        ]}
                      />
                      <View style={styles.railLine} />
                    </View>

                    <Card variant={isDue ? 'urgent' : 'default'} style={styles.futureCard}>
                      <View style={styles.rowBetween}>
                        <View
                          style={[
                            styles.statusPill,
                            isDue && styles.statusPillDanger,
                            isPrnSafe && styles.statusPillSuccess,
                          ]}
                        >
                          <Text
                            style={[
                              styles.futureStatus,
                              isDue && { color: colors.dangerText },
                              isPrnSafe && { color: colors.successText },
                            ]}
                          >
                            {statusLabel}
                          </Text>
                        </View>
                        <Text style={styles.freqTag}>{tr.frequency_label}</Text>
                      </View>

                      <Text style={styles.medName}>{tr.brand_name}</Text>
                      {tr.active_ingredients && (
                        <Text style={styles.activeIng}>{tr.active_ingredients}</Text>
                      )}
                      <Text style={styles.doseLine}>Dosis: {tr.dose_text}</Text>
                      {tr.notes && <Text style={styles.noteText}>ℹ {tr.notes}</Text>}

                      {isCaregiver && (
                        <PillButton
                          label="Marcar Administrada"
                          icon="checkmark-circle"
                          variant={isDue ? 'danger' : 'primary'}
                          style={styles.adminBtn}
                          onPress={() =>
                            router.push({
                              pathname: '/modals/apply-dose',
                              params: { treatmentId: tr.id },
                            })
                          }
                        />
                      )}
                    </Card>
                  </View>
                );
              })}
            </View>
          )}
        </>
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
    paddingBottom: spacing.xxl + spacing.md,
  },
  bannerSpacing: {
    marginBottom: spacing.md,
  },
  memberRow: {
    marginBottom: spacing.md,
    marginHorizontal: -spacing.lg,
  },
  memberRowContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  memberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.pill,
  },
  memberPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  memberPillTextSelected: {
    color: colors.textInverse,
  },
  memberRoleText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textTertiary,
  },
  memberRoleTextSelected: {
    color: 'rgba(255,255,255,0.85)',
  },
  addMemberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  addMemberText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  heroHeader: {
    marginBottom: spacing.md,
    gap: 2,
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    marginBottom: spacing.xl,
  },
  quickActionBtn: {
    flex: 1,
  },
  sectionTitle: {
    ...typography.title,
    marginBottom: spacing.md,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.headline,
  },
  emptySub: {
    ...typography.subhead,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 19,
  },
  timelineWrap: {
    paddingLeft: 2,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  railCol: {
    width: 22,
    alignItems: 'center',
  },
  dotPast: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
    marginTop: 18,
  },
  dotFuture: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: colors.primary,
    marginTop: 18,
  },
  dotUrgent: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  dotSafe: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  railLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginTop: 4,
  },
  pastCard: {
    flex: 1,
    padding: spacing.md,
    marginBottom: spacing.sm + 2,
    marginLeft: spacing.sm,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pastTime: {
    ...typography.caption,
    ...typography.tabularNums,
    color: colors.textSecondary,
  },
  pastBy: {
    ...typography.caption,
  },
  pastTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 3,
  },
  pastSub: {
    ...typography.subhead,
    marginTop: 2,
  },
  noteText: {
    fontSize: 12,
    color: colors.warningText,
    marginTop: spacing.xs,
  },
  nowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  nowBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  nowText: {
    color: colors.textInverse,
    fontSize: 11,
    fontWeight: '700',
    ...typography.tabularNums,
  },
  nowLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: colors.primary,
    opacity: 0.35,
    marginLeft: spacing.sm,
  },
  futureCard: {
    flex: 1,
    marginBottom: spacing.md,
    marginLeft: spacing.sm,
  },
  statusPill: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusPillDanger: {
    backgroundColor: colors.dangerSoft,
  },
  statusPillSuccess: {
    backgroundColor: colors.successSoft,
  },
  futureStatus: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    ...typography.tabularNums,
  },
  freqTag: {
    ...typography.caption,
  },
  medName: {
    ...typography.title,
    fontSize: 18,
    marginTop: spacing.sm,
  },
  activeIng: {
    ...typography.subhead,
    marginTop: 2,
  },
  doseLine: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  adminBtn: {
    marginTop: spacing.md,
  },
});
