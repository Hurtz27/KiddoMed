import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKiddoMed } from '../../context/KiddoMedContext';
import { registerDoseTransaction } from '../../services/kiddomed';
import { RegisterDoseResult } from '../../types/database';
import { formatDateTimeShort } from '../../utils/formatting';

const TOLERANCE_OPTIONS = [
  { label: 'Sin incidentes', value: '' },
  { label: 'Vomitó (< 20 min)', value: 'Vomitó antes de 20 min' },
  { label: 'Vomitó (> 30 min)', value: 'Vomitó después de 30 min' },
  { label: 'Escupió parcialmente', value: 'Escupió parcialmente' },
];

export default function ApplyDoseModal() {
  const { treatmentId } = useLocalSearchParams<{ treatmentId: string }>();
  const router = useRouter();
  const { session, isCaregiver, treatments, members } = useKiddoMed();

  const treatment = treatments.find((t) => t.id === treatmentId);
  const member = members.find((m) => m.id === treatment?.member_id);

  const [administeredAt, setAdministeredAt] = useState(new Date());
  const [pickerMode, setPickerMode] = useState<'time' | 'date' | null>(null);
  const [toleranceNote, setToleranceNote] = useState('');
  const [customNote, setCustomNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [earlyWarning, setEarlyWarning] = useState<Extract<
    RegisterDoseResult,
    { status: 'TOO_EARLY' }
  > | null>(null);
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);

  const handleOffsetMinutes = useCallback((mins: number) => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - mins);
    setAdministeredAt(now);
  }, []);

  if (!isCaregiver) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Solo el nivel Cuidador puede marcar dosis administradas.</Text>
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
      const combinedNote = [toleranceNote, customNote.trim()].filter(Boolean).join(' · ') || null;
      const res = await registerDoseTransaction({
        familyId: session!.family_id,
        treatmentId: treatment!.id,
        administeredAtIso: administeredAt.toISOString(),
        administeredByMemberName: session!.display_name,
        forceOverride,
        notes: combinedNote,
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
      Alert.alert(
        'Sin conexión o error',
        'No se pudo confirmar la aplicación en el servidor.\n\n' +
          (err instanceof Error ? err.message : '')
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.summaryCard}>
        <Text style={styles.patientTag}>{member.display_name}</Text>
        <Text style={styles.medTitle}>{treatment.brand_name}</Text>
        {treatment.active_ingredients && (
          <Text style={styles.activeText}>Activo: {treatment.active_ingredients}</Text>
        )}
        <Text style={styles.doseLine}>Dosis: {treatment.dose_text}</Text>
      </View>

      <Text style={styles.label}>Hora de administración (permite hora anterior)</Text>
      <View style={styles.chipRow}>
        {[0, 15, 30, 60].map((m) => (
          <Pressable key={m} style={styles.chip} onPress={() => handleOffsetMinutes(m)}>
            <Text style={styles.chipText}>
              {m === 0 ? 'Ahora' : m === 60 ? 'Hace 1h' : `Hace ${m}m`}
            </Text>
          </Pressable>
        ))}
        <Pressable style={styles.chip} onPress={() => setPickerMode('date')}>
          <Ionicons name="calendar-outline" size={14} color="#0284C7" />
          <Text style={styles.chipText}>Fecha</Text>
        </Pressable>
        <Pressable style={styles.chip} onPress={() => setPickerMode('time')}>
          <Ionicons name="time-outline" size={14} color="#0284C7" />
          <Text style={styles.chipText}>{formatDateTimeShort(administeredAt.toISOString())}</Text>
        </Pressable>
      </View>

      {pickerMode && (
        <DateTimePicker
          value={administeredAt}
          mode={pickerMode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={new Date()}
          onChange={(_, date) => {
            if (Platform.OS === 'android') setPickerMode(null);
            if (date) setAdministeredAt(date);
          }}
        />
      )}

      <Text style={styles.label}>Tolerancia / Evento (Opcional)</Text>
      <View style={styles.chipRow}>
        {TOLERANCE_OPTIONS.map((opt) => {
          const active = toleranceNote === opt.value;
          return (
            <Pressable
              key={opt.label}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setToleranceNote(opt.value)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {toleranceNote.includes('antes de 20 min') && (
        <View style={styles.clinicalTip}>
          <Ionicons name="information-circle" size={18} color="#B45309" />
          <Text style={styles.clinicalTipText}>
            Guía pediátrica: Si vomitó antes de 15-20 min, generalmente no se absorbió. Consulta al
            médico antes de repetir la dosis.
          </Text>
        </View>
      )}

      <Text style={styles.label}>Nota adicional (Opcional)</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej. Tomó bien con agua"
        value={customNote}
        onChangeText={setCustomNote}
      />

      <Pressable
        style={[styles.confirmBtn, submitting && { opacity: 0.6 }]}
        onPress={() => submitDose(false)}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.confirmText}>
            Marcar Administrada ({formatDateTimeShort(administeredAt.toISOString())})
          </Text>
        )}
      </Pressable>

      {/* ESCUDO ROJO BLOQUEANTE ANTI-SOBREDOSIS */}
      <Modal visible={Boolean(earlyWarning)} animationType="slide" transparent>
        <View style={styles.redOverlay}>
          <View style={styles.redCard}>
            <Ionicons name="warning" size={52} color="#DC2626" />
            <Text style={styles.redTitle}>¡DEMASIADO PRONTO!</Text>
            <Text style={styles.redBody}>
              {member.display_name} recibió {treatment.brand_name} hace solo{' '}
              <Text style={{ fontWeight: '800' }}>{earlyWarning?.minutes_ago} minutos</Text>,
              marcado por <Text style={{ fontWeight: '800' }}>{earlyWarning?.last_member}</Text>.
            </Text>
            <Text style={styles.redSub}>
              Intervalo mínimo seguro: {earlyWarning?.min_safety_hours} horas.
            </Text>

            <Pressable
              style={styles.checkboxRow}
              onPress={() => setOverrideConfirmed((v) => !v)}
            >
              <Ionicons
                name={overrideConfirmed ? 'checkbox' : 'square-outline'}
                size={24}
                color="#991B1B"
              />
              <Text style={styles.checkboxLabel}>
                Entiendo el riesgo y confirmo registrar esta dosis.
              </Text>
            </Pressable>

            <Pressable style={styles.cancelRedBtn} onPress={() => setEarlyWarning(null)}>
              <Text style={styles.cancelRedText}>Cancelar y No Aplicar</Text>
            </Pressable>

            <Pressable
              style={[
                styles.overrideBtn,
                (!overrideConfirmed || submitting) && { opacity: 0.4 },
              ]}
              disabled={!overrideConfirmed || submitting}
              onPress={() => submitDose(true)}
            >
              <Text style={styles.overrideText}>Registrar de todas formas</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  errorText: { color: '#DC2626', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  summaryCard: {
    backgroundColor: '#E0F2FE',
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
  },
  patientTag: { fontSize: 12, fontWeight: '800', color: '#0369A1', textTransform: 'uppercase' },
  medTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginTop: 2 },
  activeText: { fontSize: 13, color: '#334155', fontStyle: 'italic' },
  doseLine: { fontSize: 14, color: '#0F172A', marginTop: 6, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '700', color: '#334155', marginTop: 14, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  chipActive: { backgroundColor: '#0284C7', borderColor: '#0284C7' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  chipTextActive: { color: '#FFFFFF' },
  clinicalTip: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  clinicalTipText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 17 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
  },
  confirmBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  confirmText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  redOverlay: {
    flex: 1,
    backgroundColor: 'rgba(127, 29, 29, 0.92)',
    justifyContent: 'center',
    padding: 20,
  },
  redCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, alignItems: 'center' },
  redTitle: { fontSize: 22, fontWeight: '900', color: '#DC2626', marginTop: 10 },
  redBody: { fontSize: 15, color: '#0F172A', textAlign: 'center', marginTop: 10, lineHeight: 22 },
  redSub: { fontSize: 13, color: '#475569', textAlign: 'center', marginTop: 8 },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 10,
  },
  checkboxLabel: { flex: 1, fontSize: 13, color: '#991B1B', fontWeight: '600' },
  cancelRedBtn: {
    width: '100%',
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 18,
  },
  cancelRedText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  overrideBtn: {
    width: '100%',
    backgroundColor: '#DC2626',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  overrideText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
