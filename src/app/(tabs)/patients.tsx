import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useKiddoMed } from '../../context/KiddoMedContext';
import {
  generateMemberInviteCode,
  suspendTreatmentItem,
  updateIllnessStatus,
} from '../../services/kiddomed';
import { AccessRole, FamilyMember } from '../../types/database';
import {
  calculateAgeLabel,
  formatDateOnly,
  getRelationshipLabel,
} from '../../utils/formatting';

export default function MembersScreen() {
  const router = useRouter();
  const { session, isCaregiver, members, illnesses, treatments } = useKiddoMed();

  const [inviteTarget, setInviteTarget] = useState<FamilyMember | null>(null);
  const [inviteRole, setInviteRole] = useState<AccessRole>('caregiver');
  const [generating, setGenerating] = useState(false);

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
      await Share.share({
        message: `Hola ${inviteTarget.display_name}, únete a ${session.family_name} en HL KiddoMed como ${
          inviteRole === 'caregiver' ? 'Cuidador (Admin)' : 'Paciente (Solo lectura)'
        } con el código: ${code}`,
      });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo generar el código.');
    } finally {
      setGenerating(false);
    }
  }

  function handleToggleIllness(illnessId: string, currentStatus: 'active' | 'resolved') {
    if (!session) return;
    const nextStatus = currentStatus === 'active' ? 'resolved' : 'active';
    Alert.alert(
      nextStatus === 'resolved' ? 'Marcar como resuelta' : 'Reactivar enfermedad',
      nextStatus === 'resolved'
        ? 'Saldrá de la línea del tiempo activa pero permanecerá en el historial.'
        : 'Volverá a mostrarse en tratamientos activos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () =>
            void updateIllnessStatus({
              familyId: session.family_id,
              illnessId,
              status: nextStatus,
            }),
        },
      ]
    );
  }

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Miembros de la Familia</Text>
        {isCaregiver && (
          <Pressable style={styles.addBtn} onPress={() => router.push('/modals/add-member')}>
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.addBtnText}>Miembro</Text>
          </Pressable>
        )}
      </View>

      {members.map((member) => {
        const memberIllnesses = illnesses.filter((i) => i.member_id === member.id);
        const age = calculateAgeLabel(member.birth_date);

        return (
          <View key={member.id} style={styles.memberCard}>
            <View style={styles.memberHeader}>
              <View style={[styles.avatar, { backgroundColor: member.accent_color || '#0284C7' }]}>
                <Text style={styles.avatarText}>
                  {member.display_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{member.display_name}</Text>
                <Text style={styles.memberMeta}>
                  {getRelationshipLabel(member.relationship)}
                  {age ? ` · ${age}` : ''}
                  {member.weight_kg ? ` · ${member.weight_kg} kg` : ''}
                </Text>
                {member.has_app_access && (
                  <Text style={styles.accessBadge}>
                    Acceso App: {member.access_role === 'caregiver' ? 'Cuidador (Admin)' : 'Paciente (Lectura)'}
                    {member.invite_code && !member.linked_uid ? ` · Código: ${member.invite_code}` : ''}
                  </Text>
                )}
              </View>
            </View>

            {isCaregiver && (
              <View style={styles.memberActions}>
                <Pressable
                  style={styles.actionPill}
                  onPress={() =>
                    router.push({
                      pathname: '/modals/add-illness',
                      params: { memberId: member.id },
                    })
                  }
                >
                  <Ionicons name="medkit-outline" size={14} color="#0284C7" />
                  <Text style={styles.actionPillText}>+ Enfermedad</Text>
                </Pressable>

                {!member.linked_uid && (
                  <Pressable
                    style={[styles.actionPill, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}
                    onPress={() => {
                      setInviteRole('caregiver');
                      setInviteTarget(member);
                    }}
                  >
                    <Ionicons name="key-outline" size={14} color="#15803D" />
                    <Text style={[styles.actionPillText, { color: '#15803D' }]}>
                      {member.invite_code ? 'Reenviar Código' : 'Invitar a la App'}
                    </Text>
                  </Pressable>
                )}
              </View>
            )}

            {member.allergies.length > 0 && (
              <Text style={styles.allergyLine}>⚠ Alergias: {member.allergies.join(', ')}</Text>
            )}

            <Text style={styles.subHeader}>Historial de Enfermedades</Text>
            {memberIllnesses.length === 0 ? (
              <Text style={styles.emptyText}>Sin enfermedades registradas.</Text>
            ) : (
              memberIllnesses.map((ill) => {
                const illTreatments = treatments.filter((t) => t.illness_id === ill.id);
                return (
                  <View
                    key={ill.id}
                    style={[
                      styles.illnessCard,
                      ill.status === 'resolved' && styles.illnessResolved,
                    ]}
                  >
                    <View style={styles.illnessTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.diagnosisText}>{ill.diagnosis}</Text>
                        <Text style={styles.doctorText}>
                          Dr./Dra. {ill.doctor_name} · {formatDateOnly(ill.diagnosed_at)}
                        </Text>
                      </View>
                      {isCaregiver && (
                        <Pressable
                          style={styles.statusChip}
                          onPress={() => handleToggleIllness(ill.id, ill.status)}
                        >
                          <Text style={styles.statusChipText}>
                            {ill.status === 'active' ? 'Activa' : 'Resuelta'}
                          </Text>
                        </Pressable>
                      )}
                    </View>

                    {illTreatments.map((tr) => (
                      <View key={tr.id} style={styles.trRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.trName}>
                            • {tr.brand_name}
                            {tr.active_ingredients ? ` (${tr.active_ingredients})` : ''}
                          </Text>
                          <Text style={styles.trMeta}>
                            {tr.dose_text} · {tr.frequency_label}
                            {tr.end_date ? ` · Hasta ${formatDateOnly(tr.end_date)}` : ''}
                            {tr.status === 'suspended' ? ' · [SUSPENDIDO]' : ''}
                            {tr.status === 'completed' ? ' · [COMPLETADO]' : ''}
                          </Text>
                        </View>
                        {isCaregiver && tr.status === 'active' && (
                          <Pressable
                            onPress={() => handleSuspendTreatment(tr.id, tr.brand_name)}
                            style={styles.suspendBtn}
                          >
                            <Text style={styles.suspendText}>Suspender</Text>
                          </Pressable>
                        )}
                      </View>
                    ))}

                    {isCaregiver && ill.status === 'active' && (
                      <Pressable
                        style={styles.addTrBtn}
                        onPress={() =>
                          router.push({
                            pathname: '/modals/add-treatment',
                            params: { memberId: member.id, illnessId: ill.id },
                          })
                        }
                      >
                        <Ionicons name="add-circle-outline" size={15} color="#0284C7" />
                        <Text style={styles.addTrText}>Agregar elemento de tratamiento</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })
            )}
          </View>
        );
      })}

      {/* Modal de Invitación con Rol */}
      <Modal visible={Boolean(inviteTarget)} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Invitar a {inviteTarget?.display_name}
            </Text>
            <Text style={styles.modalSub}>Elige qué nivel de acceso tendrá en la aplicación:</Text>

            <Pressable
              style={[styles.roleOption, inviteRole === 'caregiver' && styles.roleOptionActive]}
              onPress={() => setInviteRole('caregiver')}
            >
              <Text style={styles.roleTitle}>Cuidador (Administrador)</Text>
              <Text style={styles.roleDesc}>
                Puede editar familia, agregar enfermedades/tratamientos y marcar dosis como administradas.
              </Text>
            </Pressable>

            <Pressable
              style={[styles.roleOption, inviteRole === 'patient' && styles.roleOptionActive]}
              onPress={() => setInviteRole('patient')}
            >
              <Text style={styles.roleTitle}>Paciente (Solo visualización)</Text>
              <Text style={styles.roleDesc}>
                Solo puede ver su historial, tratamientos y línea del tiempo. No puede modificar ni marcar tomas.
              </Text>
            </Pressable>

            <View style={styles.modalButtons}>
              <Pressable style={styles.cancelBtn} onPress={() => setInviteTarget(null)}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmInviteBtn, generating && { opacity: 0.6 }]}
                onPress={handleGenerateInvite}
                disabled={generating}
              >
                <Text style={styles.confirmInviteText}>Generar y Compartir</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, paddingBottom: 36 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284C7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  memberCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  memberHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  memberName: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  memberMeta: { fontSize: 13, color: '#64748B', marginTop: 1 },
  accessBadge: { fontSize: 11, color: '#0369A1', fontWeight: '700', marginTop: 3 },
  memberActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionPillText: { fontSize: 12, fontWeight: '700', color: '#0284C7' },
  allergyLine: {
    marginTop: 10,
    backgroundColor: '#FEF2F2',
    color: '#991B1B',
    padding: 8,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: '600',
  },
  subHeader: { fontSize: 13, fontWeight: '700', color: '#334155', marginTop: 14, marginBottom: 8 },
  emptyText: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic' },
  illnessCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#0284C7',
  },
  illnessResolved: { borderLeftColor: '#94A3B8', opacity: 0.78 },
  illnessTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  diagnosisText: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  doctorText: { fontSize: 12, color: '#475569', marginTop: 2 },
  statusChip: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusChipText: { fontSize: 11, fontWeight: '700', color: '#334155' },
  trRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  trName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  trMeta: { fontSize: 11, color: '#475569', marginTop: 2 },
  suspendBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
  suspendText: { fontSize: 11, fontWeight: '700', color: '#B91C1C' },
  addTrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  addTrText: { fontSize: 12, fontWeight: '700', color: '#0284C7' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  modalSub: { fontSize: 13, color: '#475569', marginTop: 4, marginBottom: 14 },
  roleOption: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  roleOptionActive: { borderColor: '#0284C7', backgroundColor: '#F0F9FF', borderWidth: 1.5 },
  roleTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  roleDesc: { fontSize: 12, color: '#475569', marginTop: 2 },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  cancelText: { fontWeight: '700', color: '#334155' },
  confirmInviteBtn: {
    flex: 1.4,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#0284C7',
  },
  confirmInviteText: { fontWeight: '700', color: '#FFFFFF' },
});
