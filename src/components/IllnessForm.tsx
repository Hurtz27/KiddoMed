import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKiddoMed } from '../context/KiddoMedContext';
import {
  createIllnessRecord,
  deleteIllnessRecord,
  updateIllnessRecord,
  updateIllnessStatus,
} from '../services/kiddomed';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { Illness, IllnessStatus } from '../types/database';
import { CrossPlatformDateTimePicker } from './ui/CrossPlatformDateTimePicker';
import { PillButton } from './ui/PillButton';

interface IllnessFormProps {
  memberId?: string;
  existing?: Illness;
  readOnly?: boolean;
  showDelete?: boolean;
  onSaved?: (result: { illnessId: string; addTreatmentAfter: boolean }) => void;
  onDeleted?: () => void;
}

/**
 * Reusable form for creating, viewing, editing, and optionally deleting an illness record.
 */
export function IllnessForm({
  memberId,
  existing,
  readOnly = false,
  showDelete = false,
  onSaved,
  onDeleted,
}: IllnessFormProps) {
  const { session } = useKiddoMed();
  const isEditing = Boolean(existing);

  const [diagnosedAt, setDiagnosedAt] = useState(
    existing ? new Date(existing.diagnosed_at) : new Date()
  );
  const [showPicker, setShowPicker] = useState(false);
  const [doctorName, setDoctorName] = useState(existing?.doctor_name ?? '');
  const [diagnosis, setDiagnosis] = useState(existing?.diagnosis ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [status, setStatus] = useState<IllnessStatus>(existing?.status ?? 'active');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave(addTreatmentAfter: boolean) {
    if (!session || readOnly) return;
    if (!diagnosis.trim() || !doctorName.trim()) {
      Alert.alert('Campos requeridos', 'Ingresa el diagnóstico y el médico tratante.');
      return;
    }

    setSaving(true);
    try {
      if (isEditing && existing) {
        await updateIllnessRecord({
          familyId: session.family_id,
          illnessId: existing.id,
          diagnosis,
          doctorName,
          diagnosedAt: diagnosedAt.toISOString(),
          notes: notes || null,
        });
        if (status !== existing.status) {
          await updateIllnessStatus({
            familyId: session.family_id,
            illnessId: existing.id,
            status,
          });
        }
        Alert.alert('Guardado', 'Los detalles del diagnóstico se actualizaron correctamente.');
        onSaved?.({ illnessId: existing.id, addTreatmentAfter: false });
        return;
      }

      if (!memberId) return;
      const newIllnessId = await createIllnessRecord({
        familyId: session.family_id,
        memberId,
        diagnosis,
        doctorName,
        diagnosedAt: diagnosedAt.toISOString(),
        notes: notes || null,
        createdByName: session.display_name,
      });
      onSaved?.({ illnessId: newIllnessId, addTreatmentAfter });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  function handleDeletePress() {
    if (!session || !existing || readOnly) return;
    Alert.alert(
      'Eliminar enfermedad',
      `¿Seguro que deseas eliminar "${existing.diagnosis}"? También se eliminarán sus tratamientos y registros de dosis asociados.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteIllnessRecord({
                familyId: session.family_id,
                illnessId: existing.id,
              });
              onDeleted?.();
            } catch (err) {
              Alert.alert(
                'Error',
                err instanceof Error ? err.message : 'No se pudo eliminar la enfermedad.'
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }

  return (
    <View>
      <Text style={styles.label}>Fecha de diagnóstico / consulta</Text>
      <Pressable
        style={[styles.dateBtn, readOnly && styles.inputReadOnly]}
        onPress={() => !readOnly && setShowPicker(true)}
        disabled={readOnly}
      >
        <Text style={styles.dateText}>{diagnosedAt.toLocaleDateString()}</Text>
        {!readOnly && <Ionicons name="calendar-outline" size={18} color={colors.textTertiary} />}
      </Pressable>
      {showPicker && !readOnly && (
        <CrossPlatformDateTimePicker
          value={diagnosedAt}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={new Date()}
          onChange={(_, d) => {
            if (Platform.OS === 'android') setShowPicker(false);
            if (d) setDiagnosedAt(d);
          }}
        />
      )}

      <Text style={styles.label}>Diagnóstico *</Text>
      <TextInput
        style={[styles.input, readOnly && styles.inputReadOnly]}
        placeholder="Ej. Faringoamigdalitis aguda / Otitis media"
        placeholderTextColor={colors.textTertiary}
        value={diagnosis}
        onChangeText={setDiagnosis}
        editable={!readOnly}
      />

      <Text style={styles.label}>Médico tratante *</Text>
      <TextInput
        style={[styles.input, readOnly && styles.inputReadOnly]}
        placeholder="Ej. Dra. Garza (Pediatra)"
        placeholderTextColor={colors.textTertiary}
        value={doctorName}
        onChangeText={setDoctorName}
        editable={!readOnly}
      />

      {isEditing && (
        <>
          <Text style={styles.label}>Estado</Text>
          <View style={styles.statusRow}>
            {(['active', 'resolved'] as const).map((opt) => {
              const active = status === opt;
              return (
                <Pressable
                  key={opt}
                  disabled={readOnly}
                  onPress={() => setStatus(opt)}
                  style={[
                    styles.statusOption,
                    active && (opt === 'active' ? styles.statusActive : styles.statusResolved),
                  ]}
                >
                  <Text
                    style={[
                      styles.statusOptionText,
                      active &&
                        (opt === 'active' ? styles.statusActiveText : styles.statusResolvedText),
                    ]}
                  >
                    {opt === 'active' ? 'Activa' : 'Resuelta'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      <Text style={styles.label}>Indicaciones generales (Opcional)</Text>
      <TextInput
        style={[styles.input, styles.multilineInput, readOnly && styles.inputReadOnly]}
        multiline
        placeholder="Ej. Abundantes líquidos, vigilar fiebre mayor a 39 °C"
        placeholderTextColor={colors.textTertiary}
        value={notes}
        onChangeText={setNotes}
        editable={!readOnly}
      />

      {!readOnly && (
        <>
          {isEditing ? (
            <View style={styles.actionsBlock}>
              <PillButton
                label="Actualizar Enfermedad"
                icon="checkmark-circle-outline"
                loading={saving}
                disabled={deleting}
                onPress={() => void handleSave(false)}
              />
              {showDelete && (
                <PillButton
                  label="Eliminar enfermedad"
                  icon="trash-outline"
                  variant="dangerTinted"
                  loading={deleting}
                  disabled={saving}
                  onPress={handleDeletePress}
                />
              )}
            </View>
          ) : (
            <>
              <Pressable
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={() => void handleSave(true)}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveText}>Guardar y Agregar Tratamiento</Text>
                )}
              </Pressable>

              <Pressable
                style={[styles.secondaryBtn, saving && { opacity: 0.6 }]}
                onPress={() => void handleSave(false)}
                disabled={saving}
              >
                <Text style={styles.secondaryText}>Solo guardar enfermedad</Text>
              </Pressable>
            </>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typography.subhead,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.md + 2,
    marginBottom: spacing.xs + 2,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
  },
  multilineInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  inputReadOnly: {
    backgroundColor: colors.surfaceMuted,
    color: colors.textSecondary,
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  dateText: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  statusRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statusOption: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  statusActive: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
  },
  statusResolved: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft,
  },
  statusOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  statusActiveText: {
    color: colors.warningText,
  },
  statusResolvedText: {
    color: colors.successText,
  },
  actionsBlock: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  saveText: {
    color: colors.textInverse,
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryBtn: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: spacing.sm + 2,
  },
  secondaryText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
});
