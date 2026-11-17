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
import {
  createTreatmentItemRecord,
  updateTreatmentItemRecord,
} from '../../services/kiddomed';
import { FrequencyType, TreatmentItemType } from '../../types/database';
import { calculateEndDateIso, formatDateOnly } from '../../utils/formatting';

export default function AddOrEditTreatmentModal() {
  const { memberId, illnessId, treatmentId, copyFromTreatmentId } = useLocalSearchParams<{
    memberId?: string;
    illnessId?: string;
    treatmentId?: string;
    copyFromTreatmentId?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { session, treatments } = useKiddoMed();

  const existing = treatmentId ? treatments.find((t) => t.id === treatmentId) : undefined;
  const template =
    !existing && copyFromTreatmentId
      ? treatments.find((t) => t.id === copyFromTreatmentId)
      : undefined;
  const source = existing ?? template;
  const isEditing = Boolean(existing);

  const [itemType, setItemType] = useState<TreatmentItemType>(
    source?.item_type ?? 'medication'
  );
  const [brandName, setBrandName] = useState(source?.brand_name ?? '');
  const [activeIngredients, setActiveIngredients] = useState(
    source?.active_ingredients ?? ''
  );
  const [doseText, setDoseText] = useState(source?.dose_text ?? '');
  const [startDate, setStartDate] = useState(
    existing ? new Date(existing.start_date) : new Date()
  );
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [durationDays, setDurationDays] = useState(
    source?.duration_days !== null && source?.duration_days !== undefined
      ? String(source.duration_days)
      : source
      ? ''
      : '7'
  );
  const [frequencyType, setFrequencyType] = useState<FrequencyType>(
    source?.frequency_type ?? 'hours'
  );
  const [frequencyValue, setFrequencyValue] = useState(
    source ? String(source.frequency_value) : '8'
  );
  const [prnLabel, setPrnLabel] = useState(
    source?.frequency_type === 'prn'
      ? source.frequency_label
      : 'Cada que haya fiebre > 38 °C'
  );
  const [minSafetyHours, setMinSafetyHours] = useState(
    source ? String(source.min_safety_hours) : '6'
  );
  const [notes, setNotes] = useState(source?.notes ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      title: isEditing
        ? 'Editar Tratamiento'
        : template
        ? 'Copiar Tratamiento'
        : 'Nuevo Elemento de Tratamiento',
    });
  }, [isEditing, template, navigation]);

  const calculatedEndDate = useMemo(() => {
    const days = parseInt(durationDays, 10);
    if (Number.isNaN(days) || days <= 0) return null;
    return calculateEndDateIso(startDate.toISOString(), days);
  }, [startDate, durationDays]);

  async function handleSave() {
    if (!session) return;
    if (!brandName.trim() || !doseText.trim()) {
      Alert.alert('Campos requeridos', 'Ingresa el nombre y la dosis o indicación.');
      return;
    }

    const daysNum = durationDays.trim() ? parseInt(durationDays, 10) : null;
    const freqNum = Number(frequencyValue.replace(',', '.'));
    const safetyNum = Number(minSafetyHours.replace(',', '.'));

    if (frequencyType !== 'prn' && (Number.isNaN(freqNum) || freqNum <= 0)) {
      Alert.alert('Frecuencia inválida', 'Ingresa un número válido de horas o días.');
      return;
    }

    const freqLabel =
      frequencyType === 'hours'
        ? `Cada ${freqNum} horas`
        : frequencyType === 'days'
        ? `Cada ${freqNum} días`
        : prnLabel.trim() || 'Si requiere (PRN)';

    setSaving(true);
    try {
      if (isEditing && existing) {
        await updateTreatmentItemRecord({
          familyId: session.family_id,
          treatmentId: existing.id,
          itemType,
          brandName,
          activeIngredients: itemType === 'medication' ? activeIngredients || null : null,
          doseText,
          startDateIso: startDate.toISOString(),
          durationDays: daysNum && daysNum > 0 ? daysNum : null,
          frequencyType,
          frequencyValue: frequencyType === 'prn' ? safetyNum || 6 : freqNum,
          frequencyLabel: freqLabel,
          minSafetyHours: !Number.isNaN(safetyNum) && safetyNum > 0 ? safetyNum : 4,
          notes: notes || null,
        });
      } else {
        if (!memberId || !illnessId) return;
        await createTreatmentItemRecord({
          familyId: session.family_id,
          memberId,
          illnessId,
          itemType,
          brandName,
          activeIngredients: itemType === 'medication' ? activeIngredients || null : null,
          doseText,
          startDateIso: startDate.toISOString(),
          durationDays: daysNum && daysNum > 0 ? daysNum : null,
          frequencyType,
          frequencyValue: frequencyType === 'prn' ? safetyNum || 6 : freqNum,
          frequencyLabel: freqLabel,
          minSafetyHours: !Number.isNaN(safetyNum) && safetyNum > 0 ? safetyNum : 4,
          notes: notes || null,
        });
      }
      router.back();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Tipo de elemento</Text>
      <View style={styles.row}>
        <Pressable
          style={[styles.typeBtn, itemType === 'medication' && styles.typeBtnActive]}
          onPress={() => setItemType('medication')}
        >
          <Text style={[styles.typeText, itemType === 'medication' && styles.typeTextActive]}>
            Medicamento
          </Text>
        </Pressable>
        <Pressable
          style={[styles.typeBtn, itemType === 'care' && styles.typeBtnActive]}
          onPress={() => setItemType('care')}
        >
          <Text style={[styles.typeText, itemType === 'care' && styles.typeTextActive]}>
            Cuidado / Otro
          </Text>
        </Pressable>
      </View>

      <Text style={styles.label}>
        {itemType === 'medication' ? 'Nombre de patente (comercial) *' : 'Nombre del tratamiento *'}
      </Text>
      <TextInput
        style={styles.input}
        placeholder={itemType === 'medication' ? 'Ej. Clavulin 12h o Tempra' : 'Ej. Lavado nasal / Nebulización'}
        value={brandName}
        onChangeText={setBrandName}
      />

      {itemType === 'medication' && (
        <>
          <Text style={styles.label}>Elementos activos (Opcional pero recomendado)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. Amoxicilina / Ác. Clavulánico o Paracetamol"
            value={activeIngredients}
            onChangeText={setActiveIngredients}
          />
        </>
      )}

      <Text style={styles.label}>Dosis o indicación *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej. 5 ml, 12 gotas, 1 tableta, 10 min"
        value={doseText}
        onChangeText={setDoseText}
      />

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Fecha de inicio</Text>
          <Pressable style={styles.dateBtn} onPress={() => setShowStartPicker(true)}>
            <Text style={styles.dateText}>{startDate.toLocaleDateString()}</Text>
          </Pressable>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Días de tratamiento</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. 7 (vacío = indefinido)"
            keyboardType="number-pad"
            value={durationDays}
            onChangeText={setDurationDays}
          />
        </View>
      </View>

      {calculatedEndDate && (
        <Text style={styles.endDateBadge}>
          📅 Fecha final calculada: {formatDateOnly(calculatedEndDate)}
        </Text>
      )}

      {showStartPicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            if (Platform.OS === 'android') setShowStartPicker(false);
            if (d) setStartDate(d);
          }}
        />
      )}

      <Text style={styles.label}>Frecuencia</Text>
      <View style={styles.row}>
        {[
          { label: 'Cada X horas', value: 'hours' as const },
          { label: 'Cada X días', value: 'days' as const },
          { label: 'Otro / Fiebre', value: 'prn' as const },
        ].map((f) => {
          const active = frequencyType === f.value;
          return (
            <Pressable
              key={f.value}
              style={[styles.typeBtn, active && styles.typeBtnActive]}
              onPress={() => setFrequencyType(f.value)}
            >
              <Text style={[styles.typeText, active && styles.typeTextActive]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {frequencyType === 'prn' ? (
        <>
          <Text style={styles.label}>Criterio de aplicación</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. Cada que haya fiebre > 38 °C"
            value={prnLabel}
            onChangeText={setPrnLabel}
          />
        </>
      ) : (
        <Text style={styles.label}>
          Cada cuántos {frequencyType === 'hours' ? 'horas' : 'días'}
        </Text>
      )}

      {frequencyType !== 'prn' && (
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={frequencyValue}
          onChangeText={setFrequencyValue}
        />
      )}

      <Text style={styles.label}>Intervalo mínimo seguro (Alerta roja anti-doble toma en horas)</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        value={minSafetyHours}
        onChangeText={setMinSafetyHours}
      />

      <Text style={styles.label}>Notas (Opcional)</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej. Con alimentos, Refrigerar, Agitar antes de usar"
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
          <Text style={styles.saveText}>
            {isEditing ? 'Actualizar Tratamiento' : 'Guardar Elemento del Tratamiento'}
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
    padding: 11,
    fontSize: 14,
  },
  row: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  typeBtnActive: { backgroundColor: '#0284C7', borderColor: '#0284C7' },
  typeText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  typeTextActive: { color: '#FFFFFF' },
  dateBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
  },
  dateText: { fontSize: 14, color: '#0F172A' },
  endDateBadge: {
    marginTop: 8,
    backgroundColor: '#E0F2FE',
    color: '#0369A1',
    padding: 8,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 24,
  },
  saveText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
