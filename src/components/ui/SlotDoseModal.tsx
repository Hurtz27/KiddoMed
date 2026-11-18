import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useKiddoMed } from '../../context/KiddoMedContext';
import { registerDoseTransaction, revertDoseLogTransaction } from '../../services/kiddomed';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { RegisterDoseResult } from '../../types/database';
import { showAlert } from '../../utils/alert';
import { formatDateTimeShort, formatTimeShort } from '../../utils/formatting';
import { MemberSlotGroup, ProjectedDose } from '../../utils/schedule';
import { PillButton } from './PillButton';

interface SlotDoseModalProps {
  group: MemberSlotGroup | null;
  isCaregiver: boolean;
  onClose: () => void;
  onOpenCustomApply: (treatmentId: string) => void;
}

function isMoreThan30MinsAhead(dueAtMs: number): boolean {
  return dueAtMs > Date.now() + 30 * 60_000;
}

function formatRemainingWait(dueAtMs: number): string {
  const mins = Math.max(1, Math.round((dueAtMs - Date.now()) / 60_000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

/**
 * Sheet modal showing all medications due or already applied for a member in a time slot,
 * with large touch targets, an in-app future-dose warning card, anti-overdose shield, and undo support.
 */
export function SlotDoseModal({
  group,
  isCaregiver,
  onClose,
  onOpenCustomApply,
}: SlotDoseModalProps) {
  const { session } = useKiddoMed();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [appliedDoseIds, setAppliedDoseIds] = useState<Set<string>>(new Set());
  const [futureConfirmDose, setFutureConfirmDose] = useState<ProjectedDose | null>(null);
  const [earlyWarning, setEarlyWarning] = useState<{
    dose: ProjectedDose;
    result: Extract<RegisterDoseResult, { status: 'TOO_EARLY' }>;
  } | null>(null);
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);

  const handleClose = () => {
    setAppliedDoseIds(new Set());
    setBusyId(null);
    setFutureConfirmDose(null);
    setEarlyWarning(null);
    setOverrideConfirmed(false);
    onClose();
  };

  if (!group) return null;

  const memberColor = group.member.accent_color || colors.primary;

  async function executeApply(dose: ProjectedDose, forceOverride = false) {
    if (!session) return;
    setBusyId(dose.id);
    setFutureConfirmDose(null);
    try {
      const res = await registerDoseTransaction({
        familyId: session.family_id,
        treatmentId: dose.treatment.id,
        administeredAtIso: new Date().toISOString(),
        administeredByMemberName: session.display_name,
        forceOverride,
        notes: null,
      });

      if (res.status === 'TOO_EARLY') {
        if (Platform.OS !== 'web') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        setOverrideConfirmed(false);
        setEarlyWarning({ dose, result: res });
        return;
      }

      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setEarlyWarning(null);
      setAppliedDoseIds((prev) => {
        const next = new Set(prev);
        next.add(dose.id);
        return next;
      });

      const nextInfo = res.next_due_at
        ? `\nPróxima toma: ${formatDateTimeShort(res.next_due_at)}`
        : '';
      showAlert(
        '✓ Dosis aplicada',
        `Se registró ${dose.treatment.brand_name} (${dose.treatment.dose_text}) para ${group!.member.display_name}.${nextInfo}`
      );

      if (group && appliedDoseIds.size + 1 >= group.pendingCount) {
        handleClose();
      }
    } catch (err) {
      showAlert(
        'Error al registrar',
        err instanceof Error ? err.message : 'No se pudo registrar la dosis.'
      );
    } finally {
      setBusyId(null);
    }
  }

  function handleApplyPress(dose: ProjectedDose) {
    if (!dose.isOverdue && isMoreThan30MinsAhead(dose.dueAtMs)) {
      Haptics.selectionAsync().catch(() => {});
      setFutureConfirmDose(dose);
      return;
    }
    const nowTime = formatTimeShort(new Date().toISOString());
    showAlert(
      'Confirmar dosis',
      `¿Seguro que quieres aplicar ${dose.treatment.brand_name} (${dose.treatment.dose_text}) a ${group!.member.display_name} a las ${nowTime}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, aplicar',
          onPress: () => {
            void executeApply(dose);
          },
        },
      ]
    );
  }

  function handleRevertPress(dose: ProjectedDose) {
    if (!session || !dose.doseLogId) return;
    showAlert(
      '¿Marcar como error?',
      `Se revertirá la toma de ${dose.treatment.brand_name} (${formatTimeShort(dose.dueAtIso)}) para que vuelva a estar pendiente y se recalcule el horario.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Volver a pendiente',
          style: 'destructive',
          onPress: async () => {
            setBusyId(dose.id);
            try {
              await revertDoseLogTransaction({
                familyId: session.family_id,
                doseLogId: dose.doseLogId!,
              });
              if (Platform.OS !== 'web') {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              showAlert(
                'Dosis revertida',
                `${dose.treatment.brand_name} volvió a estado pendiente.`
              );
              handleClose();
            } catch (err) {
              showAlert(
                'Error al revertir',
                err instanceof Error ? err.message : 'No se pudo deshacer la dosis.'
              );
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  }

  return (
    <Modal visible={Boolean(group)} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={styles.memberCluster}>
              <View style={[styles.colorDot, { backgroundColor: memberColor }]} />
              <View>
                <Text style={styles.memberName}>{group.member.display_name}</Text>
                <Text style={styles.slotLabel}>{group.dateLabel}</Text>
              </View>
            </View>
            <Pressable style={styles.closeBtn} onPress={handleClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {earlyWarning ? (
            <View style={styles.shieldBox}>
              <View style={styles.shieldHeader}>
                <Ionicons name="warning" size={26} color={colors.danger} />
                <Text style={styles.shieldTitle}>¡DEMASIADO PRONTO!</Text>
              </View>
              <Text style={styles.shieldBody}>
                {group.member.display_name} recibió{' '}
                <Text style={{ fontWeight: '700' }}>{earlyWarning.dose.treatment.brand_name}</Text>{' '}
                hace solo{' '}
                <Text style={{ fontWeight: '700' }}>{earlyWarning.result.minutes_ago} min</Text> (por{' '}
                {earlyWarning.result.last_member}). Intervalo mínimo seguro:{' '}
                {earlyWarning.result.min_safety_hours}h.
              </Text>

              <Pressable
                style={styles.checkboxRow}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setOverrideConfirmed((v) => !v);
                }}
              >
                <Ionicons
                  name={overrideConfirmed ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={colors.dangerText}
                />
                <Text style={styles.checkboxLabel}>
                  Entiendo el riesgo y confirmo aplicar esta dosis.
                </Text>
              </Pressable>

              <View style={styles.shieldActions}>
                <PillButton
                  label="Cancelar"
                  variant="secondary"
                  style={styles.actionHalfBtn}
                  onPress={() => setEarlyWarning(null)}
                />
                <PillButton
                  label="Aplicar igual"
                  variant="danger"
                  style={styles.actionHalfBtn}
                  disabled={!overrideConfirmed}
                  loading={busyId === earlyWarning.dose.id}
                  onPress={() => executeApply(earlyWarning.dose, true)}
                />
              </View>
            </View>
          ) : futureConfirmDose ? (
            <View style={styles.futureBox}>
              <View style={styles.shieldHeader}>
                <Ionicons name="time" size={26} color={colors.warning} />
                <Text style={styles.futureTitle}>¿Aplicar dosis antes de tiempo?</Text>
              </View>
              <Text style={styles.shieldBody}>
                Esta toma de{' '}
                <Text style={{ fontWeight: '700' }}>{futureConfirmDose.treatment.brand_name}</Text>{' '}
                está programada para{' '}
                <Text style={{ fontWeight: '700' }}>
                  {formatDateTimeShort(futureConfirmDose.dueAtIso)}
                </Text>{' '}
                (faltan{' '}
                <Text style={{ fontWeight: '700' }}>
                  {formatRemainingWait(futureConfirmDose.dueAtMs)}
                </Text>
                ).
              </Text>
              <Text style={styles.futureSubBody}>
                Si la aplicas ahora, las siguientes dosis se recalcularán a partir de este momento.
              </Text>

              <View style={styles.shieldActions}>
                <PillButton
                  label="Cancelar"
                  variant="secondary"
                  style={[styles.actionHalfBtn, styles.cancelOutlineBtn]}
                  onPress={() => setFutureConfirmDose(null)}
                />
                <PillButton
                  label="Sí, aplicar ahora"
                  variant="primary"
                  style={styles.actionHalfBtn}
                  loading={busyId === futureConfirmDose.id}
                  onPress={() => executeApply(futureConfirmDose)}
                />
              </View>
            </View>
          ) : (
            <ScrollView
              style={styles.list}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {group.doses.map((dose) => {
                const isLocallyApplied = appliedDoseIds.has(dose.id);
                const isApplied = dose.status === 'applied' || isLocallyApplied;
                const isLoading = busyId === dose.id;

                return (
                  <View
                    key={dose.id}
                    style={[
                      styles.doseCard,
                      { borderLeftColor: memberColor },
                      isApplied && styles.doseCardApplied,
                    ]}
                  >
                    <View style={styles.doseInfo}>
                      <View style={styles.doseTop}>
                        <Text
                          style={[styles.medName, isApplied && styles.medNameDone]}
                          numberOfLines={2}
                        >
                          {dose.treatment.brand_name}
                        </Text>
                        <Text style={[styles.exactTime, typography.tabularNums]}>
                          {dose.isOverdue
                            ? dose.treatment.next_due_at
                              ? formatTimeShort(dose.dueAtIso)
                              : '1ª toma'
                            : formatTimeShort(dose.dueAtIso)}
                        </Text>
                      </View>
                      {dose.treatment.active_ingredients && (
                        <Text style={styles.activeIngredient} numberOfLines={1}>
                          {dose.treatment.active_ingredients}
                        </Text>
                      )}
                      <Text style={styles.medMeta}>
                        Dosis: {dose.treatment.dose_text} · {dose.treatment.frequency_label}
                      </Text>
                      {isApplied && (
                        <View style={styles.appliedMetaRow}>
                          <Ionicons name="checkmark-circle" size={14} color={colors.successText} />
                          <Text style={styles.appliedByText}>
                            Aplicada{dose.administeredBy ? ` por ${dose.administeredBy}` : ''}
                          </Text>
                        </View>
                      )}
                      {!isApplied && !dose.isImmediateNext && (
                        <Text style={styles.projectedTag}>Toma futura programada</Text>
                      )}
                    </View>

                    {isCaregiver && (
                      <View style={styles.cardActionsRow}>
                        {isApplied ? (
                          dose.doseLogId ? (
                            <Pressable
                              disabled={isLoading}
                              style={({ pressed }) => [
                                styles.undoBtn,
                                pressed && styles.btnPressed,
                              ]}
                              onPress={() => handleRevertPress(dose)}
                            >
                              <Ionicons name="arrow-undo" size={16} color={colors.dangerText} />
                              <Text style={styles.undoBtnText}>
                                {isLoading ? 'Revirtiendo...' : 'Deshacer (Error)'}
                              </Text>
                            </Pressable>
                          ) : null
                        ) : (
                          <>
                            <Pressable
                              disabled={isLoading}
                              style={({ pressed }) => [
                                styles.secondaryActionBtn,
                                pressed && styles.btnPressed,
                              ]}
                              onPress={() => {
                                handleClose();
                                onOpenCustomApply(dose.treatment.id);
                              }}
                            >
                              <Ionicons name="time-outline" size={16} color={colors.textPrimary} />
                              <Text style={styles.secondaryActionText}>Otra hora</Text>
                            </Pressable>

                            <Pressable
                              disabled={isLoading}
                              style={({ pressed }) => [
                                styles.primaryActionBtn,
                                { backgroundColor: memberColor },
                                pressed && styles.btnPressed,
                              ]}
                              onPress={() => handleApplyPress(dose)}
                            >
                              <Ionicons name="checkmark" size={17} color={colors.textInverse} />
                              <Text style={styles.primaryActionText}>
                                {isLoading ? 'Guardando...' : 'Aplicar'}
                              </Text>
                            </Pressable>
                          </>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    maxHeight: '82%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  memberCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  memberName: {
    ...typography.title,
    fontSize: 19,
  },
  slotLabel: {
    ...typography.subhead,
    marginTop: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    maxHeight: 430,
  },
  doseCard: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderLeftWidth: 4,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  doseCardApplied: {
    opacity: 0.85,
  },
  doseInfo: {
    gap: 2,
  },
  doseTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  medName: {
    ...typography.headline,
    fontSize: 17,
    flex: 1,
  },
  medNameDone: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
  },
  activeIngredient: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  exactTime: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  medMeta: {
    ...typography.footnote,
    marginTop: 2,
  },
  appliedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  appliedByText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.successText,
  },
  projectedTag: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.warningText,
    marginTop: 3,
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryActionBtn: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  primaryActionBtn: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textInverse,
  },
  undoBtn: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
  },
  undoBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.dangerText,
  },
  btnPressed: {
    opacity: 0.78,
  },
  shieldBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  futureBox: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  shieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  shieldTitle: {
    ...typography.headline,
    color: colors.dangerText,
  },
  futureTitle: {
    ...typography.headline,
    color: colors.warningText,
    flex: 1,
  },
  shieldBody: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  futureSubBody: {
    ...typography.subhead,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.dangerText,
  },
  shieldActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  actionHalfBtn: {
    flex: 1,
  },
  cancelOutlineBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
