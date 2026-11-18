import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/ui/Card';
import { SlotDoseModal } from '../../components/ui/SlotDoseModal';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { useKiddoMed } from '../../context/KiddoMedContext';
import { exportMemberPdf } from '../../services/exportPdf';
import { colors, radius, shadows, spacing, typography } from '../../theme/tokens';
import { formatMinutesDiff } from '../../utils/formatting';
import { buildTreatmentSchedule, MemberSlotGroup } from '../../utils/schedule';

export default function TreatmentScheduleScreen() {
  const router = useRouter();
  const {
    session,
    isCaregiver,
    isOffline,
    members,
    illnesses,
    treatments,
    doseLogs,
    symptomLogs,
    selectedMemberId,
  } = useKiddoMed();

  const [filterId, setFilterId] = useState<'all' | string>('all');
  const [showApplied, setShowApplied] = useState(true);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [overdueExpanded, setOverdueExpanded] = useState(true);
  const [prnExpanded, setPrnExpanded] = useState(true);
  const [activeSlotGroup, setActiveSlotGroup] = useState<MemberSlotGroup | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Refresh schedule and relative countdowns on every minute boundary and when returning to foreground
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextMinute = () => {
      if (timerId) clearTimeout(timerId);
      const now = Date.now();
      const msUntilNextMinute = 60_000 - (now % 60_000) + 50;
      timerId = setTimeout(() => {
        setNowMs(Date.now());
        scheduleNextMinute();
      }, msUntilNextMinute);
    };

    scheduleNextMinute();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setNowMs(Date.now());
        scheduleNextMinute();
      }
    });

    return () => {
      if (timerId) clearTimeout(timerId);
      sub.remove();
    };
  }, []);

  const selectedMember =
    filterId === 'all' ? null : members.find((m) => m.id === filterId) ?? null;
  const fallbackMember = selectedMember ?? members.find((m) => m.id === selectedMemberId) ?? members[0] ?? null;

  const schedule = useMemo(
    () =>
      buildTreatmentSchedule({
        treatments,
        illnesses,
        members,
        doseLogs,
        memberFilterId: filterId,
        nowMs,
      }),
    [treatments, illnesses, members, doseLogs, filterId, nowMs]
  );

  // Default Today and Tomorrow to expanded
  const isDayExpanded = (dateKey: string, idx: number) => {
    if (dateKey in expandedDays) return expandedDays[dateKey];
    return idx <= 1;
  };

  const toggleDay = (dateKey: string, idx: number) => {
    Haptics.selectionAsync().catch(() => {});
    setExpandedDays((prev) => ({
      ...prev,
      [dateKey]: !isDayExpanded(dateKey, idx),
    }));
  };

  const handleExportPdf = async () => {
    if (!fallbackMember || exportingPdf) return;
    setExportingPdf(true);
    try {
      await exportMemberPdf({
        member: fallbackMember,
        illnesses: illnesses.filter((i) => i.member_id === fallbackMember.id),
        treatments: treatments.filter((t) => t.member_id === fallbackMember.id),
        doseLogs: doseLogs.filter((d) => d.member_id === fallbackMember.id),
        symptomLogs: symptomLogs.filter((s) => s.member_id === fallbackMember.id),
      });
    } catch (err) {
      Alert.alert(
        'Error al exportar',
        err instanceof Error ? err.message : 'No se pudo generar el PDF.'
      );
    } finally {
      setExportingPdf(false);
    }
  };

  const renderMemberSlotBox = (group: MemberSlotGroup, isWide: boolean, isUrgent = false) => {
    const memberColor = group.member.accent_color || colors.primary;
    const isAllApplied = group.pendingCount === 0 && group.appliedCount > 0;
    const boxBg = isUrgent
      ? colors.dangerSoft
      : isAllApplied
      ? `${memberColor}0A`
      : `${memberColor}16`;
    const borderColor = isUrgent ? colors.danger : memberColor;
    const headerColor = isUrgent ? colors.dangerText : memberColor;

    return (
      <Pressable
        key={`${group.member.id}-${group.slotKey}`}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          setActiveSlotGroup(group);
        }}
        style={({ pressed }) => [
          styles.slotBox,
          isWide ? styles.slotBoxFull : styles.slotBoxShared,
          {
            backgroundColor: boxBg,
            borderLeftColor: borderColor,
          },
          isAllApplied && styles.slotBoxApplied,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.slotBoxHeader}>
          <View style={styles.slotMemberCluster}>
            <View style={[styles.slotDot, { backgroundColor: borderColor }]} />
            <Text style={[styles.slotMemberName, { color: headerColor }]} numberOfLines={1}>
              {group.member.display_name}
            </Text>
          </View>
          {isAllApplied ? (
            <View style={styles.appliedBadge}>
              <Ionicons name="checkmark-circle" size={13} color={colors.successText} />
              <Text style={styles.appliedBadgeText}>Aplicada</Text>
            </View>
          ) : (
            <View style={[styles.countBadge, { backgroundColor: borderColor }]}>
              <Text style={styles.countBadgeText}>{group.doses.length}</Text>
            </View>
          )}
        </View>

        <View style={styles.slotMedsList}>
          {group.doses.map((dose) => {
            const done = dose.status === 'applied';
            return (
              <View key={dose.id} style={styles.slotMedItem}>
                <View style={styles.slotMedRow}>
                  {done && (
                    <Ionicons
                      name="checkmark-circle"
                      size={14}
                      color={colors.successText}
                      style={{ marginRight: 2 }}
                    />
                  )}
                  <Text
                    style={[styles.slotMedBrand, done && styles.slotMedBrandDone]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {dose.treatment.brand_name}
                  </Text>
                  <Text
                    style={styles.slotMedDose}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {dose.treatment.dose_text}
                  </Text>
                </View>
                {dose.treatment.active_ingredients && (
                  <Text style={styles.slotMedActive} numberOfLines={1}>
                    {dose.treatment.active_ingredients}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Cabecera */}
        <View style={styles.headerRow}>
          <View style={styles.headerTitleGroup}>
            <Image
              source={require('../../../assets/icon.png')}
              style={styles.headerLogo}
              accessibilityLabel="HL KiddoMed"
            />
            <View style={{ flex: 1 }}>
              <Text style={typography.largeTitle}>Tratamiento</Text>
              <Text style={styles.familySub}>
                {session?.family_name ?? 'Agenda de dosis'}
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            {fallbackMember && (
              <Pressable
                style={styles.iconActionBtn}
                onPress={handleExportPdf}
                disabled={exportingPdf}
                accessibilityLabel="Exportar PDF"
              >
                {exportingPdf ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="share-outline" size={20} color={colors.primary} />
                )}
              </Pressable>
            )}
          </View>
        </View>

        {/* Filtro: Toda la familia o por integrante */}
        {members.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterBleed}
            contentContainerStyle={styles.filterContent}
          >
            <Pressable
              style={[styles.filterChip, filterId === 'all' && styles.filterChipActive]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setFilterId('all');
              }}
            >
              <Ionicons
                name="people"
                size={14}
                color={filterId === 'all' ? colors.textInverse : colors.textSecondary}
              />
              <Text
                style={[
                  styles.filterChipText,
                  filterId === 'all' && styles.filterChipTextActive,
                ]}
              >
                Toda la familia
              </Text>
            </Pressable>

            {members.map((m) => {
              const active = filterId === m.id;
              const accent = m.accent_color || colors.primary;
              return (
                <Pressable
                  key={m.id}
                  style={[
                    styles.filterChip,
                    active && { backgroundColor: accent, borderColor: accent },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setFilterId(m.id);
                  }}
                >
                  <View
                    style={[
                      styles.filterDot,
                      { backgroundColor: active ? colors.textInverse : accent },
                    ]}
                  />
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                    {m.display_name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Elección para mostrar u ocultar dosis ya aplicadas */}
        <Pressable
          style={styles.appliedToggleRow}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setShowApplied((v) => !v);
          }}
        >
          <View style={styles.appliedToggleLeft}>
            <Ionicons
              name={showApplied ? 'eye-outline' : 'eye-off-outline'}
              size={16}
              color={showApplied ? colors.primary : colors.textSecondary}
            />
            <Text style={styles.appliedToggleText}>Mostrar dosis aplicadas</Text>
          </View>
          <Switch
            value={showApplied}
            onValueChange={(v) => {
              Haptics.selectionAsync().catch(() => {});
              setShowApplied(v);
            }}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.surface}
          />
        </Pressable>

        {isOffline && (
          <StatusBanner
            tone="warning"
            icon="cloud-offline"
            message="Modo sin conexión: mostrando los últimos datos guardados."
            style={styles.bannerSpacing}
          />
        )}

        {selectedMember && selectedMember.allergies.length > 0 && (
          <StatusBanner
            tone="danger"
            icon="alert-circle"
            message={`Alergias de ${selectedMember.display_name}: ${selectedMember.allergies.join(', ')}`}
            style={styles.bannerSpacing}
          />
        )}

        {/* Bloque urgente: Atrasadas o 1ª toma pendiente */}
        {schedule.overdueByMember.length > 0 && (
          <View style={styles.section}>
            <Pressable
              style={styles.dayHeader}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setOverdueExpanded((v) => !v);
              }}
            >
              <View style={styles.dayHeaderLeft}>
                <Ionicons
                  name={overdueExpanded ? 'chevron-down' : 'chevron-forward'}
                  size={18}
                  color={colors.dangerText}
                />
                <Text style={[styles.dayTitle, { color: colors.dangerText }]}>
                  Pendientes ahora / Atrasadas
                </Text>
              </View>
              <View style={[styles.dayBadge, { backgroundColor: colors.dangerSoft }]}>
                <Text style={[styles.dayBadgeText, { color: colors.dangerText }]}>
                  {schedule.overdueDoses.length}
                </Text>
              </View>
            </Pressable>

            {overdueExpanded && (
              <View style={styles.overdueGrid}>
                {schedule.overdueByMember.map((group) =>
                  renderMemberSlotBox(group, schedule.overdueByMember.length === 1, true)
                )}
              </View>
            )}
          </View>
        )}

        {/* Calendario vertical por días (expandibles/colapsables) */}
        <View style={styles.section}>
          {schedule.days.map((day, idx) => {
            const expanded = isDayExpanded(day.dateKey, idx);
            const visibleSlots = showApplied
              ? day.slots
              : day.slots
                  .map((slot) => ({
                    ...slot,
                    memberGroups: slot.memberGroups
                      .filter((g) => g.pendingCount > 0)
                      .map((g) => ({
                        ...g,
                        doses: g.doses.filter((d) => d.status !== 'applied'),
                      })),
                  }))
                  .filter((slot) => slot.memberGroups.length > 0);

            return (
              <View key={day.dateKey} style={styles.dayBlock}>
                <Pressable
                  style={styles.dayHeader}
                  onPress={() => toggleDay(day.dateKey, idx)}
                >
                  <View style={styles.dayHeaderLeft}>
                    <Ionicons
                      name={expanded ? 'chevron-down' : 'chevron-forward'}
                      size={18}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.dayTitle}>{day.label}</Text>
                  </View>
                  <View style={styles.dayBadge}>
                    <Text style={styles.dayBadgeText}>
                      {day.totalDoses === 0
                        ? 'Sin tomas'
                        : day.appliedDoses > 0
                        ? `${day.appliedDoses}/${day.totalDoses} aplicadas`
                        : `${day.totalDoses} ${day.totalDoses === 1 ? 'toma' : 'tomas'}`}
                    </Text>
                  </View>
                </Pressable>

                {expanded && (
                  <View style={styles.dayBody}>
                    {visibleSlots.length === 0 ? (
                      <Card style={styles.emptyDayCard}>
                        <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} />
                        <Text style={styles.emptyDayText}>
                          {!showApplied && day.appliedDoses > 0 && day.pendingDoses === 0
                            ? 'Todas las dosis de este día ya fueron aplicadas.'
                            : 'Sin dosis programadas para este día.'}
                        </Text>
                      </Card>
                    ) : (
                      visibleSlots.map((slot) => {
                        const isOverlapping = slot.memberGroups.length > 1;
                        return (
                          <View key={slot.slotKey} style={styles.timeRow}>
                            <View style={styles.timeCol}>
                              <Text style={[styles.timeText, typography.tabularNums]}>
                                {slot.slotKey}
                              </Text>
                            </View>
                            {slot.memberGroups.length > 2 ? (
                              <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.slotScrollContent}
                                style={styles.slotScroll}
                              >
                                {slot.memberGroups.map((group) =>
                                  renderMemberSlotBox(group, false)
                                )}
                              </ScrollView>
                            ) : (
                              <View
                                style={[
                                  styles.slotBoxesRow,
                                  isOverlapping && styles.slotBoxesRowMulti,
                                ]}
                              >
                                {slot.memberGroups.map((group) =>
                                  renderMemberSlotBox(group, !isOverlapping)
                                )}
                              </View>
                            )}
                          </View>
                        );
                      })
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Sección Si requiere (PRN) */}
        {schedule.prnItems.length > 0 && (
          <View style={styles.section}>
            <Pressable
              style={styles.dayHeader}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setPrnExpanded((v) => !v);
              }}
            >
              <View style={styles.dayHeaderLeft}>
                <Ionicons
                  name={prnExpanded ? 'chevron-down' : 'chevron-forward'}
                  size={18}
                  color={colors.textSecondary}
                />
                <Text style={styles.dayTitle}>Si requiere (PRN)</Text>
              </View>
              <View style={styles.dayBadge}>
                <Text style={styles.dayBadgeText}>{schedule.prnItems.length}</Text>
              </View>
            </Pressable>

            {prnExpanded && (
              <View style={styles.prnList}>
                {schedule.prnItems.map(({ treatment: tr, member }) => {
                  const memberColor = member.accent_color || colors.primary;
                  const countdown = tr.next_due_at ? formatMinutesDiff(tr.next_due_at) : null;
                  const isSafe = !countdown || countdown.isOverdue;

                  return (
                    <Pressable
                      key={tr.id}
                      style={({ pressed }) => [styles.prnCard, pressed && styles.pressed]}
                      onPress={() => {
                        if (!isCaregiver) return;
                        router.push({
                          pathname: '/modals/apply-dose',
                          params: { treatmentId: tr.id },
                        });
                      }}
                    >
                      <View style={[styles.prnAccent, { backgroundColor: memberColor }]} />
                      <View style={{ flex: 1 }}>
                        <View style={styles.prnTopRow}>
                          <Text style={[styles.prnMember, { color: memberColor }]}>
                            {member.display_name}
                          </Text>
                          <View
                            style={[
                              styles.prnStatusPill,
                              {
                                backgroundColor: isSafe ? colors.successSoft : colors.warningSoft,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.prnStatusText,
                                { color: isSafe ? colors.successText : colors.warningText },
                              ]}
                            >
                              {isSafe
                                ? 'Disponible'
                                : `Esperar ${countdown!.label.replace('En ', '')}`}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.prnMed}>{tr.brand_name}</Text>
                        {tr.active_ingredients && (
                          <Text style={styles.prnActive}>{tr.active_ingredients}</Text>
                        )}
                        <Text style={styles.prnMeta}>
                          {tr.dose_text} · {tr.frequency_label}
                        </Text>
                      </View>
                      {isCaregiver && (
                        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <SlotDoseModal
        group={activeSlotGroup}
        isCaregiver={isCaregiver}
        onClose={() => setActiveSlotGroup(null)}
        onOpenCustomApply={(treatmentId) =>
          router.push({ pathname: '/modals/apply-dose', params: { treatmentId } })
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerTitleGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerLogo: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
  },
  familySub: {
    ...typography.footnote,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.pill,
  },
  filterBleed: {
    marginHorizontal: -spacing.lg,
    marginBottom: spacing.sm,
  },
  filterContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.textInverse,
  },
  appliedToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    marginBottom: spacing.xs,
  },
  appliedToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  appliedToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  bannerSpacing: {
    marginTop: spacing.sm,
  },
  section: {
    marginTop: spacing.md,
  },
  dayBlock: {
    marginBottom: spacing.md,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  dayHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  dayTitle: {
    ...typography.headline,
    fontSize: 16,
  },
  dayBadge: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  dayBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  dayBody: {
    marginTop: spacing.xs,
    gap: spacing.sm + 2,
  },
  emptyDayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  emptyDayText: {
    ...typography.subhead,
    color: colors.textTertiary,
  },
  overdueGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  timeCol: {
    width: 48,
    paddingTop: spacing.sm + 2,
    alignItems: 'flex-end',
  },
  timeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  slotBoxesRow: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  slotBoxesRowMulti: {
    alignItems: 'stretch',
  },
  slotScroll: {
    flex: 1,
  },
  slotScrollContent: {
    gap: spacing.sm,
  },
  slotBox: {
    borderRadius: radius.md,
    borderLeftWidth: 4,
    padding: spacing.sm + 2,
  },
  slotBoxApplied: {
    opacity: 0.72,
  },
  slotBoxFull: {
    flex: 1,
  },
  slotBoxShared: {
    flex: 1,
    minWidth: 132,
  },
  slotBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  slotMemberCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  slotDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  slotMemberName: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textInverse,
  },
  appliedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surface,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  appliedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.successText,
  },
  slotMedsList: {
    marginTop: 6,
    gap: 5,
  },
  slotMedItem: {
    gap: 1,
  },
  slotMedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  slotMedBrand: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    minWidth: 0,
  },
  slotMedBrandDone: {
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  slotMedDose: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    maxWidth: '42%',
    flexShrink: 1,
    textAlign: 'right',
  },
  slotMedActive: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.8,
  },
  prnList: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  prnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.card,
  },
  prnAccent: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
  },
  prnTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  prnMember: {
    fontSize: 12,
    fontWeight: '700',
  },
  prnStatusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  prnStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  prnMed: {
    ...typography.headline,
    fontSize: 16,
    marginTop: 2,
  },
  prnActive: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 1,
  },
  prnMeta: {
    ...typography.footnote,
    marginTop: 1,
  },
});
