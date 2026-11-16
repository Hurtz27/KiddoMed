import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
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
import { exportMemberPdf } from '../../services/exportPdf';
import { formatDateTimeShort, getTemperatureColor } from '../../utils/formatting';

export default function HistoryAndSearchScreen() {
  const {
    members,
    illnesses,
    treatments,
    doseLogs,
    symptomLogs,
    selectedMemberId,
  } = useKiddoMed();

  const [queryText, setQueryText] = useState('');
  const [exporting, setExporting] = useState(false);

  const activeMember = members.find((m) => m.id === selectedMemberId) ?? members[0] ?? null;
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m.display_name])), [members]);
  const treatmentMap = useMemo(() => new Map(treatments.map((t) => [t.id, t])), [treatments]);

  const filteredTreatments = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return [];
    return treatments.filter(
      (t) =>
        t.brand_name.toLowerCase().includes(q) ||
        (t.active_ingredients?.toLowerCase().includes(q) ?? false)
    );
  }, [queryText, treatments]);

  const timeline = useMemo(() => {
    const q = queryText.trim().toLowerCase();

    const dItems = doseLogs
      .filter((d) => {
        if (!q) return true;
        const tr = treatmentMap.get(d.treatment_item_id);
        return (
          (tr?.brand_name.toLowerCase().includes(q) ?? false) ||
          (tr?.active_ingredients?.toLowerCase().includes(q) ?? false)
        );
      })
      .map((d) => {
        const tr = treatmentMap.get(d.treatment_item_id);
        return {
          kind: 'dose' as const,
          id: `d-${d.id}`,
          timestamp: d.administered_at,
          memberName: memberMap.get(d.member_id) ?? 'Miembro',
          brandName: tr?.brand_name ?? 'Tratamiento',
          activeIngredients: tr?.active_ingredients ?? null,
          doseText: d.dose_text,
          by: d.administered_by_member_name,
          early: d.was_early_override,
          notes: d.notes,
        };
      });

    const sItems = q
      ? []
      : symptomLogs.map((s) => ({
          kind: 'symptom' as const,
          id: `s-${s.id}`,
          timestamp: s.recorded_at,
          memberName: memberMap.get(s.member_id) ?? 'Miembro',
          temp: s.temperature_celsius,
          symptoms: s.symptoms,
          by: s.recorded_by_name,
          notes: s.notes,
        }));

    return [...dItems, ...sItems].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [queryText, doseLogs, symptomLogs, memberMap, treatmentMap]);

  async function handleExport() {
    if (!activeMember) return;
    setExporting(true);
    try {
      await exportMemberPdf({
        member: activeMember,
        illnesses: illnesses.filter((i) => i.member_id === activeMember.id),
        treatments: treatments.filter((t) => t.member_id === activeMember.id),
        doseLogs: doseLogs.filter((d) => d.member_id === activeMember.id),
        symptomLogs: symptomLogs.filter((s) => s.member_id === activeMember.id),
      });
    } catch (err) {
      Alert.alert('Error al exportar', err instanceof Error ? err.message : 'No se pudo generar el PDF.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Buscador Dual: Patente + Activo */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#64748B" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por patente o activo (ej. Tempra o Paracetamol)"
          value={queryText}
          onChangeText={setQueryText}
        />
        {queryText.length > 0 && (
          <Pressable onPress={() => setQueryText('')}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </Pressable>
        )}
      </View>

      {filteredTreatments.length > 0 && (
        <View style={styles.matchBox}>
          <Text style={styles.matchTitle}>Tratamientos coincidentes ({filteredTreatments.length})</Text>
          {filteredTreatments.map((t) => (
            <Text key={t.id} style={styles.matchItem}>
              • {t.brand_name} {t.active_ingredients ? `(${t.active_ingredients})` : ''} —{' '}
              {memberMap.get(t.member_id)}
            </Text>
          ))}
        </View>
      )}

      {activeMember && (
        <Pressable
          style={[styles.exportBtn, exporting && { opacity: 0.6 }]}
          onPress={handleExport}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="share-outline" size={20} color="#FFFFFF" />
              <Text style={styles.exportBtnText}>
                Exportar PDF de {activeMember.display_name} (WhatsApp / Médico)
              </Text>
            </>
          )}
        </Pressable>
      )}

      <Text style={styles.sectionTitle}>Bitácora Completa</Text>

      {timeline.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No se encontraron registros.</Text>
        </View>
      ) : (
        timeline.map((item) => (
          <View key={item.id} style={styles.logCard}>
            <View style={styles.logHeader}>
              <Text style={styles.logMember}>{item.memberName}</Text>
              <Text style={styles.logTime}>{formatDateTimeShort(item.timestamp)}</Text>
            </View>
            {item.kind === 'dose' ? (
              <>
                <Text style={styles.logMain}>
                  {item.brandName}
                  {item.activeIngredients ? ` (${item.activeIngredients})` : ''} — {item.doseText}
                </Text>
                <Text style={styles.logSub}>Administrado por {item.by}</Text>
                {item.early && (
                  <Text style={styles.overrideTag}>⚠ Confirmado antes del intervalo mínimo</Text>
                )}
                {item.notes && <Text style={styles.noteTag}>Nota: {item.notes}</Text>}
              </>
            ) : (
              <>
                <Text style={[styles.logMain, { color: getTemperatureColor(item.temp) }]}>
                  {item.temp !== null ? `Temperatura: ${item.temp.toFixed(1)} °C` : 'Síntomas'}
                </Text>
                {item.symptoms.length > 0 && (
                  <Text style={styles.logSub}>Síntomas: {item.symptoms.join(', ')}</Text>
                )}
                <Text style={styles.logSub}>Registrado por {item.by}</Text>
                {item.notes && <Text style={styles.noteTag}>Nota: {item.notes}</Text>}
              </>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, paddingBottom: 36 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#0F172A' },
  matchBox: {
    backgroundColor: '#F0F9FF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  matchTitle: { fontSize: 12, fontWeight: '800', color: '#0369A1', marginBottom: 4 },
  matchItem: { fontSize: 13, color: '#0F172A', marginTop: 2 },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0F766E',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 18,
  },
  exportBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A', marginBottom: 10 },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyText: { color: '#64748B', fontSize: 14 },
  logCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  logMember: { fontSize: 12, fontWeight: '700', color: '#0284C7' },
  logTime: { fontSize: 12, color: '#64748B' },
  logMain: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  logSub: { fontSize: 13, color: '#475569', marginTop: 2 },
  overrideTag: { fontSize: 12, color: '#DC2626', fontWeight: '700', marginTop: 4 },
  noteTag: { fontSize: 12, color: '#B45309', marginTop: 4 },
});
