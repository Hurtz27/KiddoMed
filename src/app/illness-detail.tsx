import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IllnessForm } from '../components/IllnessForm';
import { Card } from '../components/ui/Card';
import { PillButton } from '../components/ui/PillButton';
import { useKiddoMed } from '../context/KiddoMedContext';
import { suspendTreatmentItem } from '../services/kiddomed';
import { colors, radius, shadows, spacing, typography } from '../theme/tokens';
import { TreatmentItem } from '../types/database';
import { formatDateOnly } from '../utils/formatting';

type DetailTab = 'details' | 'treatments';

export default function IllnessDetailScreen() {
  const { illnessId } = useLocalSearchParams<{ illnessId?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { session, isCaregiver, members, illnesses, treatments } = useKiddoMed();

  const [activeTab, setActiveTab] = useState<DetailTab>('details');
  const [recentModalVisible, setRecentModalVisible] = useState(false);

  const illness = illnesses.find((i) => i.id === illnessId);
  const member = illness ? members.find((m) => m.id === illness.member_id) : undefined;

  useEffect(() => {
    navigation.setOptions({
      title: illness ? illness.diagnosis : 'Detalle de Enfermedad',
    });
  }, [illness, navigation]);

  const illnessTreatments = useMemo(() => {
    if (!illness) return [];
    return treatments.filter((t) => t.illness_id === illness.id);
  }, [treatments, illness]);

  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m.display_name])), [members]);
  const illnessMap = useMemo(() => new Map(illnesses.map((i) => [i.id, i.diagnosis])), [illnesses]);

  // Unique recently added treatments across the family, ordered newest-first.
  const recentTemplates = useMemo(() => {
    const seen = new Set<string>();
    const list: TreatmentItem[] = [];
    for (const tr of treatments) {
      const key = `${tr.item_type}|${tr.brand_name.trim().toLowerCase()}|${(
        tr.active_ingredients ?? ''
      )
        .trim()
        .toLowerCase()}|${tr.dose_text.trim().toLowerCase()}|${tr.frequency_label
        .trim()
        .toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(tr);
      if (list.length >= 20) break;
    }
    return list;
  }, [treatments]);

  function handleSuspendTreatment(treatmentId: string, name: string) {
    if (!session) return;
    Alert.alert(
      `Suspender ${name}`,
      'El medicamento dejará de mostrarse como pendiente pero conservará su historial de tomas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Suspender',
          style: 'destructive',
          onPress: () =>
            void suspendTreatmentItem({
              familyId: session.family_id,
              treatmentId,
              reason: 'Suspendido por indicación / cambio de tratamiento',
            }),
        },
      ]
    );
  }

  function handleCopyRecent(template: TreatmentItem) {
    if (!illness) return;
    Haptics.selectionAsync().catch(() => {});
    setRecentModalVisible(false);
    router.push({
      pathname: '/modals/add-treatment',
      params: {
        memberId: illness.member_id,
        illnessId: illness.id,
        copyFromTreatmentId: template.id,
      },
    });
  }

  if (!illness) {
    return (
      <View style={styles.notFoundWrap}>
        <Text style={styles.notFoundTitle}>Enfermedad no encontrada</Text>
        <PillButton label="Volver" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {member && (
          <View style={styles.memberContextPill}>
            <View
              style={[
                styles.memberDot,
                { backgroundColor: member.accent_color || colors.primary },
              ]}
            />
            <Text style={styles.memberContextText}>{member.display_name}</Text>
            <Text style={styles.memberContextSep}>·</Text>
            <Text style={styles.memberContextDate}>{formatDateOnly(illness.diagnosed_at)}</Text>
          </View>
        )}

        {activeTab === 'details' ? (
          <Card style={styles.formCard}>
            <IllnessForm
              key={illness.id}
              memberId={illness.member_id}
              existing={illness}
              readOnly={!isCaregiver}
              showDelete={isCaregiver}
              onDeleted={() => router.back()}
            />
          </Card>
        ) : (
          <View style={styles.treatmentsSection}>
            {isCaregiver && (
              <View style={styles.treatmentActions}>
                <PillButton
                  label="Agregar tratamiento"
                  icon="add-circle-outline"
                  onPress={() =>
                    router.push({
                      pathname: '/modals/add-treatment',
                      params: { memberId: illness.member_id, illnessId: illness.id },
                    })
                  }
                />
                {recentTemplates.length > 0 && (
                  <PillButton
                    label="Agregados recientemente"
                    icon="copy-outline"
                    variant="tinted"
                    onPress={() => setRecentModalVisible(true)}
                  />
                )}
              </View>
            )}

            {illnessTreatments.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Ionicons name="medkit-outline" size={32} color={colors.textTertiary} />
                <Text style={styles.emptyTitle}>Sin tratamientos registrados</Text>
                <Text style={styles.emptySub}>
                  {isCaregiver
                    ? 'Agrega un nuevo medicamento o copia uno agregado recientemente.'
                    : 'Aún no hay tratamientos asociados a esta enfermedad.'}
                </Text>
              </Card>
            ) : (
              illnessTreatments.map((tr) => {
                const isActive = tr.status === 'active';
                return (
                  <Pressable
                    key={tr.id}
                    disabled={!isCaregiver}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      router.push({
                        pathname: '/modals/add-treatment',
                        params: {
                          memberId: illness.member_id,
                          illnessId: illness.id,
                          treatmentId: tr.id,
                        },
                      });
                    }}
                    style={({ pressed }) => [pressed && isCaregiver && styles.pressed]}
                  >
                    <Card
                      style={[
                        styles.trCard,
                        tr.status !== 'active' && styles.trCardInactive,
                      ]}
                    >
                      <View style={styles.trHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.trName}>{tr.brand_name}</Text>
                          {tr.active_ingredients ? (
                            <Text style={styles.trIngredients}>{tr.active_ingredients}</Text>
                          ) : null}
                        </View>
                        <View style={styles.trHeaderRight}>
                          <View
                            style={[
                              styles.trStatusBadge,
                              tr.status === 'suspended' && styles.trStatusSuspended,
                              tr.status === 'completed' && styles.trStatusCompleted,
                            ]}
                          >
                            <Text
                              style={[
                                styles.trStatusText,
                                tr.status === 'suspended' && styles.trStatusTextSuspended,
                                tr.status === 'completed' && styles.trStatusTextCompleted,
                              ]}
                            >
                              {tr.status === 'active'
                                ? 'Activo'
                                : tr.status === 'suspended'
                                ? 'Suspendido'
                                : 'Completado'}
                            </Text>
                          </View>
                          {isCaregiver && (
                            <Ionicons
                              name="create-outline"
                              size={16}
                              color={colors.textTertiary}
                            />
                          )}
                        </View>
                      </View>

                      <Text style={styles.trMeta}>
                        {tr.dose_text} · {tr.frequency_label}
                        {tr.end_date ? ` · Hasta ${formatDateOnly(tr.end_date)}` : ''}
                      </Text>

                      {tr.notes ? <Text style={styles.trNotes}>{tr.notes}</Text> : null}

                      {isCaregiver && isActive && (
                        <View style={styles.trFooter}>
                          <Pressable
                            onPress={() => handleSuspendTreatment(tr.id, tr.brand_name)}
                            style={styles.suspendBtn}
                          >
                            <Text style={styles.suspendText}>Suspender</Text>
                          </Pressable>
                        </View>
                      )}
                    </Card>
                  </Pressable>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom 2-tab bar */}
      <SafeAreaView edges={['bottom']} style={styles.bottomBarSafe}>
        <View style={styles.bottomBar}>
          <Pressable
            style={[styles.tabBtn, activeTab === 'details' && styles.tabBtnActive]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setActiveTab('details');
            }}
          >
            <Ionicons
              name={activeTab === 'details' ? 'document-text' : 'document-text-outline'}
              size={20}
              color={activeTab === 'details' ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.tabLabel, activeTab === 'details' && styles.tabLabelActive]}>
              Detalles de diagnóstico
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tabBtn, activeTab === 'treatments' && styles.tabBtnActive]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setActiveTab('treatments');
            }}
          >
            <Ionicons
              name={activeTab === 'treatments' ? 'medkit' : 'medkit-outline'}
              size={20}
              color={activeTab === 'treatments' ? colors.primary : colors.textSecondary}
            />
            <Text
              style={[styles.tabLabel, activeTab === 'treatments' && styles.tabLabelActive]}
            >
              Tratamiento ({illnessTreatments.length})
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {/* Modal: Agregados recientemente */}
      <Modal
        visible={recentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRecentModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Agregados recientemente</Text>
                <Text style={styles.modalSub}>
                  Selecciona un tratamiento para copiarlo, ajustar dosis o tiempos y guardarlo aquí.
                </Text>
              </View>
              <Pressable
                onPress={() => setRecentModalVisible(false)}
                style={styles.closeBtn}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalList}
              contentContainerStyle={{ paddingBottom: spacing.lg }}
              showsVerticalScrollIndicator={false}
            >
              {recentTemplates.map((tr) => {
                const originMember = memberMap.get(tr.member_id);
                const originDiagnosis = illnessMap.get(tr.illness_id);

                return (
                  <Pressable
                    key={tr.id}
                    style={({ pressed }) => [
                      styles.recentItem,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => handleCopyRecent(tr)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recentName}>
                        {tr.brand_name}
                        {tr.active_ingredients ? ` (${tr.active_ingredients})` : ''}
                      </Text>
                      <Text style={styles.recentMeta}>
                        {tr.dose_text} · {tr.frequency_label}
                        {tr.duration_days ? ` · ${tr.duration_days} días` : ''}
                      </Text>
                      {(originMember || originDiagnosis) && (
                        <Text style={styles.recentOrigin}>
                          {[originMember, originDiagnosis].filter(Boolean).join(' · ')}
                        </Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.primary} />
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  memberContextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  memberContextText: {
    ...typography.footnote,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  memberContextSep: {
    color: colors.textTertiary,
  },
  memberContextDate: {
    ...typography.footnote,
    ...typography.tabularNums,
    color: colors.textSecondary,
  },
  formCard: {
    borderRadius: radius.xl,
  },
  treatmentsSection: {
    gap: spacing.md,
  },
  treatmentActions: {
    gap: spacing.sm,
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
  trCard: {
    borderRadius: radius.lg,
  },
  trCardInactive: {
    opacity: 0.72,
  },
  pressed: {
    opacity: 0.84,
  },
  trHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  trHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  trName: {
    ...typography.headline,
    fontSize: 16,
  },
  trIngredients: {
    ...typography.footnote,
    color: colors.textSecondary,
    marginTop: 2,
  },
  trStatusBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  trStatusSuspended: {
    backgroundColor: colors.dangerSoft,
  },
  trStatusCompleted: {
    backgroundColor: colors.successSoft,
  },
  trStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  trStatusTextSuspended: {
    color: colors.dangerText,
  },
  trStatusTextCompleted: {
    color: colors.successText,
  },
  trMeta: {
    ...typography.subhead,
    ...typography.tabularNums,
    marginTop: spacing.sm,
  },
  trNotes: {
    ...typography.footnote,
    color: colors.textTertiary,
    marginTop: spacing.xs + 2,
  },
  trFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.sm + 2,
    paddingTop: spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
  },
  suspendBtn: {
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  suspendText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.dangerText,
  },
  bottomBarSafe: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.card,
  },
  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  tabBtnActive: {
    backgroundColor: colors.primarySoft,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    flexShrink: 1,
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  notFoundWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  notFoundTitle: {
    ...typography.headline,
    color: colors.textSecondary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '78%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  modalTitle: {
    ...typography.title,
  },
  modalSub: {
    ...typography.footnote,
    marginTop: 3,
  },
  closeBtn: {
    padding: 4,
  },
  modalList: {
    flexGrow: 0,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recentName: {
    ...typography.headline,
    fontSize: 15,
  },
  recentMeta: {
    ...typography.footnote,
    ...typography.tabularNums,
    color: colors.textSecondary,
    marginTop: 2,
  },
  recentOrigin: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 4,
  },
});
