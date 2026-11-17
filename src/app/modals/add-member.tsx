import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
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
import { createFamilyMember, updateFamilyMember } from '../../services/kiddomed';
import { colors, getFirstAvailableMemberColor, MEMBER_COLOR_PALETTE } from '../../theme/tokens';
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

export default function AddOrEditMemberModal() {
  const { memberId } = useLocalSearchParams<{ memberId?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { session, members, setSelectedMemberId } = useKiddoMed();

  const existing = memberId ? members.find((m) => m.id === memberId) : undefined;
  const isEditing = Boolean(existing);

  const usedColorOwners = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) {
      if (m.id === existing?.id || !m.accent_color) continue;
      map.set(m.accent_color.toUpperCase(), m.display_name);
    }
    return map;
  }, [members, existing?.id]);

  const [displayName, setDisplayName] = useState(existing?.display_name ?? '');
  const [relationship, setRelationship] = useState<RelationshipType>(
    existing?.relationship ?? 'hijo'
  );
  const [hasBirthDate, setHasBirthDate] = useState(
    existing ? Boolean(existing.birth_date) : true
  );
  const [birthDate, setBirthDate] = useState(
    existing?.birth_date ? new Date(existing.birth_date) : new Date(2023, 0, 1)
  );
  const [showPicker, setShowPicker] = useState(false);
  const [weight, setWeight] = useState(
    existing?.weight_kg !== null && existing?.weight_kg !== undefined
      ? String(existing.weight_kg)
      : ''
  );
  const [allergiesText, setAllergiesText] = useState(
    existing?.allergies.join(', ') ?? ''
  );
  const [color, setColor] = useState(
    existing?.accent_color ?? getFirstAvailableMemberColor(usedColorOwners.keys())
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      title: isEditing ? 'Editar Miembro' : 'Agregar Miembro Familiar',
    });
  }, [isEditing, navigation]);

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

    const colorOwner = usedColorOwners.get(color.toUpperCase());
    if (colorOwner) {
      Alert.alert(
        'Color en uso',
        `El color seleccionado ya lo usa ${colorOwner}. Elige otro color para que no se repitan.`
      );
      return;
    }

    const allergies = allergiesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      if (isEditing && existing) {
        await updateFamilyMember({
          familyId: session.family_id,
          memberId: existing.id,
          displayName,
          relationship,
          birthDate: hasBirthDate ? birthDate.toISOString().split('T')[0] : null,
          weightKg: parsedWeight,
          allergies,
          accentColor: color,
        });
      } else {
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
      }
      router.back();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar el miembro.');
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

      <Text style={styles.label}>Color identificador (único por integrante)</Text>
      <View style={styles.colorRow}>
        {MEMBER_COLOR_PALETTE.map((c) => {
          const owner = usedColorOwners.get(c.toUpperCase());
          const isTaken = Boolean(owner);
          const isSelected = color.toUpperCase() === c.toUpperCase();

          return (
            <Pressable
              key={c}
              disabled={isTaken}
              style={[
                styles.colorDot,
                { backgroundColor: c },
                isSelected && styles.colorDotSelected,
                isTaken && styles.colorDotTaken,
              ]}
              onPress={() => setColor(c)}
              accessibilityLabel={owner ? `Color en uso por ${owner}` : `Seleccionar color ${c}`}
            >
              {isTaken ? (
                <Ionicons name="lock-closed" size={14} color="#FFFFFF" />
              ) : isSelected ? (
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.saveText}>
            {isEditing ? 'Actualizar Miembro' : 'Guardar Miembro'}
          </Text>
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
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  chipTextActive: { color: '#FFFFFF' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleLink: { fontSize: 12, fontWeight: '700', color: colors.primary, marginTop: 12 },
  dateBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
  },
  dateText: { fontSize: 15, color: '#0F172A' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  colorDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDotSelected: { borderWidth: 3, borderColor: '#0F172A' },
  colorDotTaken: { opacity: 0.32 },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 28,
  },
  saveText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
});
