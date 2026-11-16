import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { useKiddoMed } from '../../context/KiddoMedContext';
import { createIllnessRecord } from '../../services/kiddomed';

export default function AddIllnessModal() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const router = useRouter();
  const { session } = useKiddoMed();

  const [diagnosedAt, setDiagnosedAt] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [doctorName, setDoctorName] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave(addTreatmentAfter: boolean) {
    if (!session || !memberId) return;
    if (!diagnosis.trim() || !doctorName.trim()) {
      Alert.alert('Campos requeridos', 'Ingresa el diagnóstico y el médico tratante.');
      return;
    }

    setSaving(true);
    try {
      const illnessId = await createIllnessRecord({
        familyId: session.family_id,
        memberId,
        diagnosis,
        doctorName,
        diagnosedAt: diagnosedAt.toISOString(),
        notes: notes || null,
        createdByName: session.display_name,
      });

      if (addTreatmentAfter) {
        router.replace({
          pathname: '/modals/add-treatment',
          params: { memberId, illnessId },
        });
      } else {
        router.back();
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Fecha de diagnóstico / consulta</Text>
      <Pressable style={styles.dateBtn} onPress={() => setShowPicker(true)}>
        <Text style={styles.dateText}>{diagnosedAt.toLocaleDateString()}</Text>
      </Pressable>
      {showPicker && (
        <DateTimePicker
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
        style={styles.input}
        placeholder="Ej. Faringoamigdalitis aguda / Otitis media"
        value={diagnosis}
        onChangeText={setDiagnosis}
      />

      <Text style={styles.label}>Médico tratante *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej. Dra. Garza (Pediatra)"
        value={doctorName}
        onChangeText={setDoctorName}
      />

      <Text style={styles.label}>Indicaciones generales (Opcional)</Text>
      <TextInput
        style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
        multiline
        placeholder="Ej. Abundantes líquidos, vigilar fiebre mayor a 39 °C"
        value={notes}
        onChangeText={setNotes}
      />

      <Pressable
        style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        onPress={() => handleSave(true)}
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
        onPress={() => handleSave(false)}
        disabled={saving}
      >
        <Text style={styles.secondaryText}>Solo guardar enfermedad</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20 },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  dateBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
  },
  dateText: { fontSize: 15, color: '#0F172A' },
  saveBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 24,
  },
  saveText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  secondaryBtn: {
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryText: { color: '#334155', fontWeight: '700', fontSize: 14 },
});
