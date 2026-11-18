import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/ui/Card';
import { PillButton } from '../../components/ui/PillButton';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { useKiddoMed } from '../../context/KiddoMedContext';
import { deleteFamilyMember, generateMemberInviteCode } from '../../services/kiddomed';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { AccessRole, FamilyMember } from '../../types/database';
import { showAlert } from '../../utils/alert';
import {
  calculateAgeLabel,
  formatDateOnly,
  getRelationshipLabel,
} from '../../utils/formatting';

export default function MembersScreen() {
  const router = useRouter();
  const { session, isCaregiver, members, illnesses } = useKiddoMed();

  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [menuMember, setMenuMember] = useState<FamilyMember | null>(null);
  const [inviteTarget, setInviteTarget] = useState<FamilyMember | null>(null);
  const [inviteRole, setInviteRole] = useState<AccessRole>('caregiver');
  const [generating, setGenerating] = useState(false);

  function toggleExpand(memberId: string) {
    Haptics.selectionAsync().catch(() => {});
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedIds((prev) => ({ ...prev, [memberId]: !prev[memberId] }));
  }

  function handleDeleteMember(member: FamilyMember) {
    if (!session) return;
    if (member.id === session.member_id) {
      showAlert(
        'Acción no permitida',
        'No puedes eliminar el perfil del miembro con el que iniciaste sesión.'
      );
      return;
    }

    showAlert(
      'Eliminar miembro',
      `¿Seguro que deseas eliminar a "${member.display_name}"? También se eliminarán sus enfermedades, tratamientos, dosis y síntomas registrados.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFamilyMember({
                familyId: session.family_id,
                memberId: member.id,
                inviteCode: member.invite_code,
              });
            } catch (err) {
              showAlert(
                'Error',
                err instanceof Error ? err.message : 'No se pudo eliminar al miembro.'
              );
            }
          },
        },
      ]
    );
  }

  async function handleGenerateInvite() {
    if (!session || !inviteTarget) return;
    setGenerating(true);
    try {
      const code = await generateMemberInviteCode({
        familyId: session.family_id,
        familyName: session.family_name,
        memberId: inviteTarget.id,
        displayName: inviteTarget.display_name,
        role: inviteRole,
      });
      setInviteTarget(null);
      const message = `Hola ${inviteTarget.display_name}, únete a ${session.family_name} en HL KiddoMed como ${
        inviteRole === 'caregiver' ? 'Cuidador (Admin)' : 'Paciente (Solo lectura)'
      } con el código: ${code}`;

      if (Platform.OS === 'web') {
        const nav = typeof navigator !== 'undefined' ? navigator : undefined;
        if (nav?.share) {
          try {
            await nav.share({ text: message });
            return;
          } catch {
            // User cancelled or share failed; fall through to clipboard/alert
          }
        }
        try {
          await nav?.clipboard?.writeText(code);
          showAlert('Código de invitación copiado', `${message}\n\n(El código ${code} se copió al portapapeles)`);
        } catch {
          showAlert('Código de invitación', message);
        }
      } else {
        await Share.share({ message });
      }
    } catch (err) {
      showAlert('Error', err instanceof Error ? err.message : 'No se pudo generar el código.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={typography.largeTitle}>Miembros</Text>
            {session?.family_name && (
              <Text style={typography.subhead}>{session.family_name}</Text>
            )}
          </View>
          {isCaregiver && (
            <Pressable
              style={styles.addBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                router.push('/modals/add-member');
              }}
            >
              <Ionicons name="add" size={18} color={colors.textInverse} />
              <Text style={styles.addBtnText}>Miembro</Text>
            </Pressable>
          )}
        </View>

        {members.map((member) => {
          const isExpanded = Boolean(expandedIds[member.id]);
          const memberIllnesses = illnesses.filter((i) => i.member_id === member.id);
          const activeCount = memberIllnesses.filter((i) => i.status === 'active').length;
          const age = calculateAgeLabel(member.birth_date);

          return (
            <Card key={member.id} style={styles.memberCard}>
              <Pressable
                style={styles.memberHeader}
                onPress={() => toggleExpand(member.id)}
                accessibilityRole="button"
                accessibilityState={{ expanded: isExpanded }}
              >
                {isExpanded && (
                  <View
                    style={[styles.avatar, { backgroundColor: member.accent_color || colors.primary }]}
                  >
                    <Text style={styles.avatarText}>
                      {member.display_name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>{member.display_name}</Text>
                  <Text style={styles.memberMeta}>
                    {getRelationshipLabel(member.relationship)}
                    {isExpanded && age ? ` · ${age}` : ''}
                    {isExpanded && member.weight_kg ? ` · ${member.weight_kg} kg` : ''}
                  </Text>
                </View>

                <View style={styles.headerActions}>
                  {isExpanded && isCaregiver && (
                    <Pressable
                      style={styles.menuBtn}
                      hitSlop={8}
                      onPress={(e) => {
                        e.stopPropagation();
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        setMenuMember(member);
                      }}
                      accessibilityLabel={`Opciones de ${member.display_name}`}
                    >
                      <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
                    </Pressable>
                  )}
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.textTertiary}
                  />
                </View>
              </Pressable>

              {isExpanded && (
                <>
                  {(activeCount > 0 || member.has_app_access) && (
                    <View style={styles.expandedBadges}>
                      {activeCount > 0 && (
                        <View style={styles.activeCountPill}>
                          <Text style={styles.activeCountText}>{activeCount} activa(s)</Text>
                        </View>
                      )}
                      {member.has_app_access && (
                        <View style={styles.accessBadgePill}>
                          <Text style={styles.accessBadge}>
                            {member.access_role === 'caregiver'
                              ? 'Cuidador (Admin)'
                              : 'Paciente (Lectura)'}
                            {member.invite_code && !member.linked_uid
                              ? ` · Código: ${member.invite_code}`
                              : ''}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {member.allergies.length > 0 && (
                    <StatusBanner
                      tone="danger"
                      icon="alert-circle"
                      message={`Alergias: ${member.allergies.join(', ')}`}
                      style={styles.allergyBanner}
                    />
                  )}

                  <View style={styles.subHeaderRow}>
                    <Text style={styles.subHeader}>Historial de Enfermedades</Text>
                    {memberIllnesses.length > 0 && (
                      <Pressable
                        style={styles.historyBtn}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          router.push({
                            pathname: '/member-illnesses',
                            params: { memberId: member.id },
                          });
                        }}
                      >
                        <Ionicons name="time-outline" size={14} color={colors.primary} />
                        <Text style={styles.historyBtnText}>
                          Historial{memberIllnesses.length > 3 ? ` (${memberIllnesses.length})` : ''}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                  {memberIllnesses.length === 0 ? (
                    <Text style={styles.emptyText}>Sin enfermedades registradas.</Text>
                  ) : (
                    memberIllnesses.slice(0, 3).map((ill) => (
                      <Pressable
                        key={ill.id}
                        style={({ pressed }) => [
                          styles.illnessCard,
                          ill.status === 'resolved' && styles.illnessResolved,
                          pressed && styles.illnessPressed,
                        ]}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          router.push({
                            pathname: '/illness-detail',
                            params: { illnessId: ill.id },
                          });
                        }}
                      >
                        <View style={styles.illnessTop}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.diagnosisText}>{ill.diagnosis}</Text>
                            <Text style={styles.doctorText}>
                              Dr./Dra. {ill.doctor_name} · {formatDateOnly(ill.diagnosed_at)}
                            </Text>
                          </View>
                          <View style={styles.illnessRight}>
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
                            <Ionicons
                              name="chevron-forward"
                              size={16}
                              color={colors.textTertiary}
                            />
                          </View>
                        </View>
                      </Pressable>
                    ))
                  )}
                </>
              )}
            </Card>
          );
        })}

        {/* Menú de opciones de miembro */}
        <Modal
          visible={Boolean(menuMember)}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuMember(null)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setMenuMember(null)}>
            <Pressable style={styles.menuCardWrapper} onPress={() => {}}>
              <Card style={styles.menuCard}>
                <Text style={styles.menuTitle}>{menuMember?.display_name}</Text>

                <Pressable
                  style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                  onPress={() => {
                    const target = menuMember;
                    setMenuMember(null);
                    if (!target) return;
                    router.push({
                      pathname: '/modals/add-member',
                      params: { memberId: target.id },
                    });
                  }}
                >
                  <Ionicons name="create-outline" size={20} color={colors.textPrimary} />
                  <Text style={styles.menuItemText}>Editar</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                  onPress={() => {
                    const target = menuMember;
                    setMenuMember(null);
                    if (!target) return;
                    router.push({
                      pathname: '/modals/add-illness',
                      params: { memberId: target.id },
                    });
                  }}
                >
                  <Ionicons name="medkit-outline" size={20} color={colors.primary} />
                  <Text style={styles.menuItemText}>+ Enfermedad</Text>
                </Pressable>

                {menuMember && !menuMember.linked_uid && (
                  <Pressable
                    style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                    onPress={() => {
                      const target = menuMember;
                      setMenuMember(null);
                      setInviteRole('caregiver');
                      setInviteTarget(target);
                    }}
                  >
                    <Ionicons name="key-outline" size={20} color={colors.successText} />
                    <Text style={styles.menuItemText}>
                      {menuMember.invite_code ? 'Reenviar Código' : 'Invitar a la App'}
                    </Text>
                  </Pressable>
                )}

                {menuMember && menuMember.id !== session?.member_id && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.menuItem,
                      styles.menuItemLast,
                      pressed && styles.menuItemPressed,
                    ]}
                    onPress={() => {
                      const target = menuMember;
                      setMenuMember(null);
                      if (target) handleDeleteMember(target);
                    }}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                    <Text style={[styles.menuItemText, styles.menuItemDanger]}>Eliminar</Text>
                  </Pressable>
                )}
              </Card>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Modal de Invitación con Rol */}
        <Modal visible={Boolean(inviteTarget)} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <Card style={styles.modalCard}>
              <Text style={styles.modalTitle}>Invitar a {inviteTarget?.display_name}</Text>
              <Text style={styles.modalSub}>Elige qué nivel de acceso tendrá en la aplicación:</Text>

              <Pressable
                style={[styles.roleOption, inviteRole === 'caregiver' && styles.roleOptionActive]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setInviteRole('caregiver');
                }}
              >
                <Text style={styles.roleTitle}>Cuidador (Administrador)</Text>
                <Text style={styles.roleDesc}>
                  Puede editar familia, agregar enfermedades/tratamientos y marcar dosis como administradas.
                </Text>
              </Pressable>

              <Pressable
                style={[styles.roleOption, inviteRole === 'patient' && styles.roleOptionActive]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setInviteRole('patient');
                }}
              >
                <Text style={styles.roleTitle}>Paciente (Solo visualización)</Text>
                <Text style={styles.roleDesc}>
                  Solo puede ver su historial, tratamientos y línea del tiempo. No puede modificar ni marcar tomas.
                </Text>
              </Pressable>

              <View style={styles.modalButtons}>
                <PillButton
                  label="Cancelar"
                  variant="secondary"
                  onPress={() => setInviteTarget(null)}
                  style={{ flex: 1 }}
                />
                <PillButton
                  label="Compartir"
                  loading={generating}
                  onPress={handleGenerateInvite}
                  style={{ flex: 1 }}
                />
              </View>
            </Card>
          </View>
        </Modal>
      </ScrollView>
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
    paddingBottom: spacing.xxl + spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm + 1,
    borderRadius: radius.pill,
  },
  addBtnText: {
    color: colors.textInverse,
    fontWeight: '600',
    fontSize: 14,
  },
  memberCard: {
    borderRadius: radius.xl,
    marginBottom: spacing.lg,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.textInverse,
    fontWeight: '700',
    fontSize: 20,
  },
  memberName: {
    ...typography.title,
    fontSize: 18,
  },
  memberMeta: {
    ...typography.subhead,
    ...typography.tabularNums,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  menuBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  activeCountPill: {
    backgroundColor: colors.warningSoft,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  activeCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.warningText,
  },
  accessBadgePill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  accessBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  menuCardWrapper: {
    width: '100%',
  },
  menuCard: {
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  menuTitle: {
    ...typography.headline,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    marginBottom: spacing.xs,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
    borderRadius: radius.sm,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  menuItemText: {
    ...typography.body,
    fontWeight: '500',
  },
  menuItemDanger: {
    color: colors.danger,
  },
  allergyBanner: {
    marginTop: spacing.md,
  },
  subHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  subHeader: {
    ...typography.footnote,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: colors.textTertiary,
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  historyBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  emptyText: {
    ...typography.subhead,
    color: colors.textTertiary,
  },
  illnessCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  illnessResolved: {
    opacity: 0.72,
  },
  illnessPressed: {
    opacity: 0.84,
  },
  illnessTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  illnessRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  diagnosisText: {
    ...typography.headline,
    fontSize: 15,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  modalTitle: {
    ...typography.title,
  },
  modalSub: {
    ...typography.subhead,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  roleOption: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm + 2,
    backgroundColor: colors.surface,
  },
  roleOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  roleTitle: {
    ...typography.headline,
    fontSize: 14,
  },
  roleDesc: {
    ...typography.footnote,
    marginTop: 3,
    lineHeight: 17,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    marginTop: spacing.md,
  },
});
