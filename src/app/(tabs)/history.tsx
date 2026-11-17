import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/ui/Card';
import { ChipGroup, ChipOption } from '../../components/ui/ChipGroup';
import { GroupedListRow } from '../../components/ui/GroupedListRow';
import { PillButton } from '../../components/ui/PillButton';
import { toDateKey } from '../../components/ui/WeekStrip';
import { useKiddoMed } from '../../context/KiddoMedContext';
import { exportMemberPdf } from '../../services/exportPdf';
import { colors, radius, shadows, spacing, typography } from '../../theme/tokens';
import { formatDateOnly, formatTimeShort, getTemperatureColor } from '../../utils/formatting';

type FilterKind = 'all' | 'dose' | 'symptom';

const FILTER_OPTIONS: ChipOption<FilterKind>[] = [
  { label: 'Todos', value: 'all' },
  { label: 'Dosis', value: 'dose' },
  { label: 'Síntomas', value: 'symptom' },
];

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
  const [filterKind, setFilterKind] = useState<FilterKind>('all');
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

  const groupedTimeline = useMemo(() => {
    const q = queryText.trim().toLowerCase();

    const dItems =
      filterKind === 'symptom'
        ? []
        : doseLogs
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
                title: `${tr?.brand_name ?? 'Tratamiento'} · ${d.dose_text}`,
                subtitle: `${memberMap.get(d.member_id) ?? 'Miembro'} · por ${d.administered_by_member_name}${
                  d.was_early_override ? ' · ⚠ Anticipada' : ''
                }`,
                iconColor: colors.successText,
              };
            });

    const sItems =
      filterKind === 'dose' || q
        ? []
        : symptomLogs.map((s) => ({
            kind: 'symptom' as const,
            id: `s-${s.id}`,
            timestamp: s.recorded_at,
            title:
              s.temperature_celsius !== null
                ? `Temperatura ${s.temperature_celsius.toFixed(1)} °C`
                : `Síntomas: ${s.symptoms.join(', ')}`,
            subtitle: `${memberMap.get(s.member_id) ?? 'Miembro'} · por ${s.recorded_by_name}`,
            iconColor: getTemperatureColor(s.temperature_celsius),
          }));

    const combined = [...dItems, ...sItems].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const todayKey = toDateKey(new Date());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = toDateKey(yesterday);

    const groups = new Map<string, { label: string; items: typeof combined }>();
    for (const item of combined) {
      const key = toDateKey(new Date(item.timestamp));
      if (!groups.has(key)) {
        const label =
          key === todayKey
            ? 'Hoy'
            : key === yesterdayKey
            ? 'Ayer'
            : formatDateOnly(item.timestamp);
        groups.set(key, { label, items: [] });
      }
      groups.get(key)!.items.push(item);
    }
    return Array.from(groups.entries());
  }, [queryText, filterKind, doseLogs, symptomLogs, memberMap, treatmentMap]);

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
      Alert.alert(
        'Error al exportar',
        err instanceof Error ? err.message : 'No se pudo generar el PDF.'
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[typography.largeTitle, styles.pageTitle]}>Historial</Text>

        {/* Buscador estilo iOS */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar patente o activo (ej. Tempra)"
            placeholderTextColor={colors.textTertiary}
            value={queryText}
            onChangeText={setQueryText}
          />
          {queryText.length > 0 && (
            <Pressable onPress={() => setQueryText('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </Pressable>
          )}
        </View>

        <ChipGroup
          options={FILTER_OPTIONS}
          value={filterKind}
          onChange={setFilterKind}
          style={styles.filterRow}
        />

        {filteredTreatments.length > 0 && (
          <Card style={styles.matchBox}>
            <Text style={styles.matchTitle}>
              Tratamientos coincidentes ({filteredTreatments.length})
            </Text>
            {filteredTreatments.map((t) => (
              <Text key={t.id} style={styles.matchItem}>
                • {t.brand_name} {t.active_ingredients ? `(${t.active_ingredients})` : ''} —{' '}
                {memberMap.get(t.member_id)}
              </Text>
            ))}
          </Card>
        )}

        {activeMember && (
          <PillButton
            label={`Exportar PDF de ${activeMember.display_name}`}
            icon="share-outline"
            variant="primary"
            loading={exporting}
            onPress={handleExport}
            style={styles.exportBtn}
          />
        )}

        {groupedTimeline.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={28} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No se encontraron registros.</Text>
          </Card>
        ) : (
          groupedTimeline.map(([key, group]) => (
            <View key={key} style={styles.groupWrap}>
              <Text style={styles.groupLabel}>{group.label}</Text>
              <Card style={styles.groupedCard}>
                {group.items.map((item, idx) => (
                  <GroupedListRow
                    key={item.id}
                    title={item.title}
                    subtitle={item.subtitle}
                    rightText={formatTimeShort(item.timestamp)}
                    icon={item.kind === 'dose' ? 'medical' : 'thermometer'}
                    iconBg={item.kind === 'dose' ? colors.successSoft : colors.warningSoft}
                    iconColor={item.iconColor}
                    showDivider={idx < group.items.length - 1}
                  />
                ))}
              </Card>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl + spacing.md,
  },
  pageTitle: {
    marginBottom: spacing.md,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 46,
    marginBottom: spacing.md,
    ...shadows.pill,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
  },
  filterRow: {
    marginBottom: spacing.md,
  },
  matchBox: {
    backgroundColor: colors.primarySoft,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  matchTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  matchItem: {
    fontSize: 13,
    color: colors.textPrimary,
    marginTop: 2,
  },
  exportBtn: {
    marginBottom: spacing.xl,
  },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  emptyText: {
    ...typography.subhead,
    color: colors.textTertiary,
  },
  groupWrap: {
    marginBottom: spacing.lg,
  },
  groupLabel: {
    ...typography.footnote,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  groupedCard: {
    paddingVertical: spacing.xs,
    borderRadius: radius.xl,
  },
});
