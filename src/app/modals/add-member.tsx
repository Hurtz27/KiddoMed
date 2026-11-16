import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
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
  View,
} from 'react-native';
import { useKiddoMed } from '../../context/KiddoMedContext';
import { createFamilyMember } from '../../services/kiddomed';
import { RelationshipType } from '../../types/database';

const RELATIONSHIPS: { label: string; value: RelationshipType }[] = [
  { label: 'Hijo', value: 'hijo' },
  { label: 'Hija', value: 'hija' },
  { label: 'Padre', value: 'padre' },
  { label: 'Madre', value: 'madre' },
  { label: 'Abuelo', value: 'abuelo' },
  { label: 'Abuela', value: 'abuela' },
  { label: 'Otro', value: 'otro' },
];

const COLORS = ['#0284C7', '#0D9488', '#7C3AED', '#DB2777', '#EA580C'];

export default function AddMemberModal() {
  const router = useRouter();
  const { session, setSelectedMemberId } = useKiddoMed();

  const [displayName, setDisplayName] = useState('');
  const [relationship, setRelationship] = useState<RelationshipType>('hijo');
  const [hasBirthDate, setHasBirthDate] = useState(true);
  const [birthDate, setBirthDate] = useState(new Date(2023, 0, 1));
  const [showPicker, setShowPicker] = useState(false);
  const [weight, setWeight] = useState('');
  const [allergiesText, setAllergiesText] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!session) return;
    if (!displayName.trim()) {
      Alert.alert('Nombre requerido', 'Ingresa el nombre del miembro.');
      return;
    }

    const parsedWeight = weight.trim() ? Number(weight.replace(',', '.')) : null;
    if (weight.trim() && (Number.isNaN(parsedWeight) || (parsedWeight ?? 0) <= 0)) {
      Alert.alert('Peso inválido', 'Ingresa un peso válido en kg.');
      return;
    }

    const allergies = allergiesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      const id = await createFamilyMember({
        familyId: session.family_id,
        displayName,
        relationship,
        birthDate: hasBirthDate ? birthDate.toISOString().split('T')[0] : null,
        weightKg: parsedWeight,
        allergies,
        accentColor: color,
      });
      setSelectedMemberId(id);
      router.back();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo crear el miembro.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Nombre *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej. Martín Jr., Norely, Abuela Rosa"
        value={displayName}
        onChangeText={setDisplayName}
      />

      <Text style={styles.label}>Parentesco *</Text>
      <View style={styles.chipRow}>
        {RELATIONSHIPS.map((r) => {
          const active = relationship === r.value;
          return (
            <Pressable
              key={r.value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setRelationship(r.value)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{r.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.label}>Fecha de nacimiento</Text>
        <Pressable onPress={() => setHasBirthDate((v) => !v)}>
          <Text style={styles.toggleLink}>{hasBirthDate ? 'Omitir' : 'Agregar'}</Text>
        </Pressable>
      </View>

      {hasBirthDate && (
        <>
          <Pressable style={styles.dateBtn} onPress={() => setShowPicker(true)}>
            <Text style={styles.dateText}>{birthDate.toLocaleDateString()}</Text>
          </Pressable>
          {showPicker && (
            <DateTimePicker
              value={birthDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              maximumDate={new Date()}
              onChange={(_, d) => {
                if (Platform.OS === 'android') setShowPicker(false);
                if (d) setBirthDate(d);
              }}
            />
          )}
        </>
      )}

      <Text style={styles.label}>Peso actual en kg (Opcional)</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej. 14.5"
        keyboardType="decimal-pad"
        value={weight}
        onChangeText={setWeight}
      />

      <Text style={styles.label}>Alergias conocidas (separadas por coma)</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej. Penicilina, Ibuprofeno"
        value={allergiesText}
        onChangeText={setAllergiesText}
      />

      <Text style={styles.label}>Color identificador</Text>
      <View style={styles.colorRow}>
        {COLORS.map((c) => (
          <Pressable
            key={c}
            style={[
              styles.colorDot,
              { backgroundColor: c },
              color === c && styles.colorDotSelected,
            ]}
            onPress={() => setColor(c)}
          />
        ))}
      </View>

      <Pressable
        style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.saveText}>Guardar Miembro</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  chipActive: { backgroundColor: '#0284C7', borderColor: '#0284C7' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  chipTextActive: { color: '#FFFFFF' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleLink: { fontSize: 12, fontWeight: '700', color: '#0284C7', marginTop: 12 },
  dateBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
  },
  dateText: { fontSize: 15, color: '#0F172A' },
  colorRow: { flexDirection: 'row', gap: 12, marginTop: 6 },
  colorDot: { width: 34, height: 34, borderRadius: 17 },
  colorDotSelected: { borderWidth: 3, borderColor: '#0F172A' },
  saveBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 28,
  },
  saveText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
});
