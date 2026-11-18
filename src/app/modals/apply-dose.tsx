import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { Card } from '../../components/ui/Card';
import { CrossPlatformDateTimePicker } from '../../components/ui/CrossPlatformDateTimePicker';
import { ChipGroup, ChipOption } from '../../components/ui/ChipGroup';
import { FormField } from '../../components/ui/FormField';
import { PillButton } from '../../components/ui/PillButton';
import { useKiddoMed } from '../../context/KiddoMedContext';
import { registerDoseTransaction } from '../../services/kiddomed';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { RegisterDoseResult } from '../../types/database';
import { showAlert } from '../../utils/alert';
import { formatDateTimeShort } from '../../utils/formatting';

const TIME_PRESETS: ChipOption<string>[] = [
  { label: 'Ahora', value: '0' },
  { label: 'Hace 15m', value: '15' },
  { label: 'Hace 30m', value: '30' },
  { label: 'Hace 1h', value: '60' },
];

export default function ApplyDoseModal() {
  const { treatmentId } = useLocalSearchParams<{ treatmentId: string }>();
  const router = useRouter();
  const { session, isCaregiver, treatments, members } = useKiddoMed();

  const treatment = treatments.find((t) => t.id === treatmentId);
  const member = members.find((m) => m.id === treatment?.member_id);

  const [administeredAt, setAdministeredAt] = useState(new Date());
  const [selectedPreset, setSelectedPreset] = useState<string>('0');
  const [pickerMode, setPickerMode] = useState<'time' | 'date' | null>(null);
  const [customNote, setCustomNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [earlyWarning, setEarlyWarning] = useState<Extract<
    RegisterDoseResult,
    { status: 'TOO_EARLY' }
  > | null>(null);
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);

  const handlePresetChange = (val: string) => {
    const mins = Number(val);
    setSelectedPreset(val);
    setPickerMode(null);
    setAdministeredAt(new Date(Date.now() - mins * 60_000));
  };

  if (!isCaregiver) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>
          Solo el nivel Cuidador puede marcar dosis administradas.
        </Text>
      </View>
    );
  }

  if (!treatment || !member || !session) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>No se encontró el elemento de tratamiento.</Text>
      </View>
    );
  }

  async function submitDose(forceOverride: boolean) {
    setSubmitting(true);
    try {
      const res = await registerDoseTransaction({
        familyId: session!.family_id,
        treatmentId: treatment!.id,
        administeredAtIso: administeredAt.toISOString(),
        administeredByMemberName: session!.display_name,
        forceOverride,
        notes: customNote.trim() || null,
      });

      if (res.status === 'TOO_EARLY') {
        if (Platform.OS !== 'web') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        setOverrideConfirmed(false);
        setEarlyWarning(res);
        setSubmitting(false);
        return;
      }

      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setEarlyWarning(null);
      router.back();
    } catch (err) {
      showAlert(
        'Sin conexión o error',
        'No se pudo confirmar la aplicación en el servidor.\n\n' +
          (err instanceof Error ? err.message : '')
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Card style={styles.summaryCard}>
        <View style={styles.patientPill}>
          <Text style={styles.patientTag}>{member.display_name}</Text>
        </View>
        <Text style={styles.medTitle}>{treatment.brand_name}</Text>
        {treatment.active_ingredients && (
          <Text style={styles.activeText}>Activo: {treatment.active_ingredients}</Text>
        )}
        <Text style={styles.doseLine}>Dosis: {treatment.dose_text}</Text>
      </Card>

      <Card style={styles.formCard}>
        <Text style={styles.sectionLabel}>Hora de administración</Text>
        <ChipGroup
          options={TIME_PRESETS}
          value={selectedPreset}
          onChange={handlePresetChange}
        />

        <View style={styles.pickerRow}>
          <Pressable style={styles.pickerBtn} onPress={() => setPickerMode('date')}>
            <Ionicons name="calendar-outline" size={16} color={colors.primary} />
            <Text style={styles.pickerText}>Cambiar fecha</Text>
          </Pressable>
          <Pressable style={styles.pickerBtn} onPress={() => setPickerMode('time')}>
            <Ionicons name="time-outline" size={16} color={colors.primary} />
            <Text style={[styles.pickerText, typography.tabularNums]}>
              {formatDateTimeShort(administeredAt.toISOString())}
            </Text>
          </Pressable>
        </View>

        {pickerMode && (
          <CrossPlatformDateTimePicker
            value={administeredAt}
            mode={pickerMode}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            onChange={(_, date) => {
              if (Platform.OS === 'android') setPickerMode(null);
              if (date) {
                setSelectedPreset('');
                setAdministeredAt(date);
              }
            }}
          />
        )}

        <FormField
          label="Nota adicional (Opcional)"
          placeholder="Ej. Tomó bien con agua"
          value={customNote}
          onChangeText={setCustomNote}
          containerStyle={styles.noteField}
        />
      </Card>

      <PillButton
        label={`Marcar Administrada (${formatDateTimeShort(administeredAt.toISOString())})`}
        icon="checkmark-circle"
        loading={submitting}
        onPress={() => submitDose(false)}
        style={styles.confirmBtn}
      />

      {/* ESCUDO ROJO BLOQUEANTE ANTI-SOBREDOSIS */}
      <Modal visible={Boolean(earlyWarning)} animationType="slide" transparent>
        <View style={styles.redOverlay}>
          <Card style={styles.redCard}>
            <View style={styles.redIconCircle}>
              <Ionicons name="warning" size={38} color={colors.danger} />
            </View>
            <Text style={styles.redTitle}>¡DEMASIADO PRONTO!</Text>
            <Text style={styles.redBody}>
              {member.display_name} recibió {treatment.brand_name} hace solo{' '}
              <Text style={{ fontWeight: '700' }}>{earlyWarning?.minutes_ago} minutos</Text>, marcado
              por <Text style={{ fontWeight: '700' }}>{earlyWarning?.last_member}</Text>.
            </Text>
            <Text style={styles.redSub}>
              Intervalo mínimo seguro: {earlyWarning?.min_safety_hours} horas.
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
                size={24}
                color={colors.dangerText}
              />
              <Text style={styles.checkboxLabel}>
                Entiendo el riesgo y confirmo registrar esta dosis.
              </Text>
            </Pressable>

            <PillButton
              label="Cancelar y No Aplicar"
              variant="secondary"
              onPress={() => setEarlyWarning(null)}
              style={styles.modalBtn}
            />

            <PillButton
              label="Registrar de todas formas"
              variant="danger"
              disabled={!overrideConfirmed}
              loading={submitting}
              onPress={() => submitDose(true)}
              style={styles.modalBtnSecondary}
            />
          </Card>
        </View>
      </Modal>
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  errorText: {
    color: colors.dangerText,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: colors.primarySoft,
    marginBottom: spacing.lg,
  },
  patientPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginBottom: spacing.xs + 2,
  },
  patientTag: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
  },
  medTitle: {
    ...typography.title,
  },
  activeText: {
    ...typography.subhead,
    marginTop: 2,
  },
  doseLine: {
    ...typography.headline,
    fontSize: 15,
    marginTop: spacing.sm,
  },
  formCard: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    ...typography.subhead,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm + 2,
  },
  pickerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primarySoft,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  pickerText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  noteField: {
    marginTop: spacing.lg,
    marginBottom: 0,
  },
  confirmBtn: {
    marginTop: spacing.xs,
  },
  redOverlay: {
    flex: 1,
    backgroundColor: 'rgba(127, 29, 29, 0.9)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  redCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
  },
  redIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redTitle: {
    ...typography.title,
    fontSize: 22,
    color: colors.danger,
    marginTop: spacing.md,
  },
  redBody: {
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.sm + 2,
    lineHeight: 22,
  },
  redSub: {
    ...typography.subhead,
    ...typography.tabularNums,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    marginTop: spacing.lg,
    backgroundColor: colors.dangerSoft,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.dangerText,
    fontWeight: '600',
  },
  modalBtn: {
    width: '100%',
    marginTop: spacing.lg,
  },
  modalBtnSecondary: {
    width: '100%',
    marginTop: spacing.sm + 2,
  },
});
