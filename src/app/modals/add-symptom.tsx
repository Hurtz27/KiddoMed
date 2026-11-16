import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKiddoMed } from '../../context/KiddoMedContext';
import { createSymptomLogRecord } from '../../services/kiddomed';
import { getTemperatureColor } from '../../utils/formatting';

const COMMON_SYMPTOMS = ['Fiebre', 'Tos', 'Congestión', 'Vómito', 'Diarrea', 'Decaimiento', 'Dolor'];

export default function AddSymptomModal() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const router = useRouter();
  const { session, illnesses } = useKiddoMed();

  const activeIllness = illnesses.find(
    (i) => i.member_id === memberId && i.status === 'active'
  );

  const [tempText, setTempText] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const parsedTemp = tempText.trim() ? Number(tempText.replace(',', '.')) : null;
  const tempValid =
    parsedTemp === null || (!Number.isNaN(parsedTemp) && parsedTemp >= 34 && parsedTemp <= 43);

  function toggleSymptom(sym: string) {
    setSelectedSymptoms((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]
    );
  }

  async function handleSave() {
    if (!session || !memberId) return;
    if (!tempValid) {
      Alert.alert('Temperatura inválida', 'Ingresa una temperatura válida entre 34.0 y 43.0 °C.');
      return;
    }
    if (parsedTemp === null && selectedSymptoms.length === 0 && !notes.trim()) {
      Alert.alert('Sin datos', 'Ingresa la temperatura o selecciona al menos un síntoma.');
      return;
    }

    setSaving(true);
    try {
      await createSymptomLogRecord({
        familyId: session.family_id,
        memberId,
        illnessId: activeIllness?.id ?? null,
        temperatureCelsius: parsedTemp,
        symptoms: selectedSymptoms,
        notes: notes || null,
        recordedByName: session.display_name,
      });
      router.back();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Temperatura (°C)</Text>
      <TextInput
        style={[
          styles.tempInput,
          { color: getTemperatureColor(tempValid ? parsedTemp : null) },
        ]}
        placeholder="Ej. 38.5"
        keyboardType="decimal-pad"
        value={tempText}
        onChangeText={setTempText}
      />

      <Text style={styles.label}>Síntomas observados</Text>
      <View style={styles.chipRow}>
        {COMMON_SYMPTOMS.map((s) => {
          const active = selectedSymptoms.includes(s);
          return (
            <Pressable
              key={s}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => toggleSymptom(s)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{s}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Notas clínicas (Opcional)</Text>
      <TextInput
        style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
        multiline
        placeholder="Ej. Se tomó baño tibio"
        value={notes}
        onChangeText={setNotes}
      />

      <Pressable
        style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.saveText}>Guardar Registro</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20 },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginTop: 14, marginBottom: 8 },
  tempInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 16,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  chipActive: { backgroundColor: '#EA580C', borderColor: '#EA580C' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  chipTextActive: { color: '#FFFFFF' },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  saveBtn: {
    backgroundColor: '#EA580C',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 24,
  },
  saveText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
});
