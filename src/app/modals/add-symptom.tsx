import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Card } from '../../components/ui/Card';
import { ChipGroup, ChipOption } from '../../components/ui/ChipGroup';
import { FormField } from '../../components/ui/FormField';
import { PillButton } from '../../components/ui/PillButton';
import { useKiddoMed } from '../../context/KiddoMedContext';
import {
  createSymptomLogRecord,
  deleteSymptomLogRecord,
  updateSymptomLogRecord,
} from '../../services/kiddomed';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { showAlert } from '../../utils/alert';
import { getTemperatureColor } from '../../utils/formatting';

const COMMON_SYMPTOMS: ChipOption<string>[] = [
  'Fiebre',
  'Tos',
  'Congestión',
  'Vómito',
  'Diarrea',
  'Decaimiento',
  'Dolor',
].map((s) => ({ label: s, value: s }));

export default function AddSymptomModal() {
  const { memberId, symptomLogId } = useLocalSearchParams<{
    memberId?: string;
    symptomLogId?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { session, illnesses, symptomLogs } = useKiddoMed();

  const existing = symptomLogId ? symptomLogs.find((s) => s.id === symptomLogId) : undefined;
  const isEditing = Boolean(existing);
  const resolvedMemberId = existing?.member_id ?? memberId;

  const activeIllness = illnesses.find(
    (i) => i.member_id === resolvedMemberId && i.status === 'active'
  );

  const [tempText, setTempText] = useState(
    existing?.temperature_celsius !== null && existing?.temperature_celsius !== undefined
      ? String(existing.temperature_celsius)
      : ''
  );
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>(existing?.symptoms ?? []);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      title: isEditing ? 'Editar Nota / Síntoma' : 'Fiebre y Síntomas',
    });
  }, [isEditing, navigation]);

  const parsedTemp = tempText.trim() ? Number(tempText.replace(',', '.')) : null;
  const tempValid =
    parsedTemp === null || (!Number.isNaN(parsedTemp) && parsedTemp >= 34 && parsedTemp <= 43);

  async function handleSave() {
    if (!session) return;
    if (!tempValid) {
      showAlert('Temperatura inválida', 'Ingresa una temperatura válida entre 34.0 y 43.0 °C.');
      return;
    }
    if (parsedTemp === null && selectedSymptoms.length === 0 && !notes.trim()) {
      showAlert('Sin datos', 'Ingresa la temperatura, un síntoma o una nota.');
      return;
    }

    setSaving(true);
    try {
      if (isEditing && existing) {
        await updateSymptomLogRecord({
          familyId: session.family_id,
          symptomLogId: existing.id,
          temperatureCelsius: parsedTemp,
          symptoms: selectedSymptoms,
          notes: notes || null,
        });
      } else {
        if (!resolvedMemberId) return;
        await createSymptomLogRecord({
          familyId: session.family_id,
          memberId: resolvedMemberId,
          illnessId: activeIllness?.id ?? null,
          temperatureCelsius: parsedTemp,
          symptoms: selectedSymptoms,
          notes: notes || null,
          recordedByName: session.display_name,
        });
      }
      router.back();
    } catch (err) {
      showAlert('Error', err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!session || !existing) return;
    showAlert(
      'Eliminar registro',
      '¿Seguro que deseas eliminar esta nota/síntoma?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteSymptomLogRecord({
                familyId: session.family_id,
                symptomLogId: existing.id,
              });
              router.back();
            } catch (err) {
              showAlert(
                'Error',
                err instanceof Error ? err.message : 'No se pudo eliminar el registro.'
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }

  const tempColor = getTemperatureColor(tempValid ? parsedTemp : null);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Card style={styles.tempCard}>
        <Text style={styles.fieldLabel}>Temperatura (°C)</Text>
        <View style={styles.tempInputWrap}>
          <TextInput
            style={[styles.tempInput, typography.tabularNums, { color: tempColor }]}
            placeholder="36.5"
            placeholderTextColor={colors.textTertiary}
            keyboardType="decimal-pad"
            value={tempText}
            onChangeText={setTempText}
          />
          <Text style={[styles.tempUnit, { color: tempColor }]}>°C</Text>
        </View>
      </Card>

      <Card style={styles.formCard}>
        <Text style={styles.fieldLabel}>Síntomas observados</Text>
        <ChipGroup
          multi
          options={COMMON_SYMPTOMS}
          value={selectedSymptoms}
          onChange={setSelectedSymptoms}
          style={{ marginBottom: spacing.lg }}
        />

        <FormField
          label="Notas clínicas (Opcional)"
          placeholder="Ej. Se tomó baño tibio"
          value={notes}
          onChangeText={setNotes}
          multiline
          containerStyle={{ marginBottom: 0 }}
        />
      </Card>

      <PillButton
        label={isEditing ? 'Actualizar Registro' : 'Guardar Registro'}
        icon="checkmark-circle"
        loading={saving}
        disabled={deleting}
        onPress={handleSave}
      />

      {isEditing && (
        <PillButton
          label="Eliminar Registro"
          icon="trash-outline"
          variant="danger"
          loading={deleting}
          disabled={saving}
          onPress={handleDelete}
          style={{ marginTop: spacing.md }}
        />
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
  tempCard: {
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  fieldLabel: {
    ...typography.subhead,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    alignSelf: 'flex-start',
  },
  tempInputWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    width: '100%',
  },
  tempInput: {
    fontSize: 36,
    fontWeight: '700',
    textAlign: 'center',
    minWidth: 100,
  },
  tempUnit: {
    fontSize: 22,
    fontWeight: '700',
    marginLeft: spacing.xs,
  },
  formCard: {
    marginBottom: spacing.xl,
  },
});
