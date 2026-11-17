import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/ui/Card';
import { toDateKey, WeekStrip } from '../../components/ui/WeekStrip';
import { useKiddoMed } from '../../context/KiddoMedContext';
import { deleteSymptomLogRecord } from '../../services/kiddomed';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { SymptomLog } from '../../types/database';
import { formatTimeShort, getTemperatureColor } from '../../utils/formatting';

export default function NotesScreen() {
  const router = useRouter();
  const { session, isCaregiver, members, symptomLogs, selectedMemberId } = useKiddoMed();

  const [filterId, setFilterId] = useState<'all' | string>('all');
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));
  const [menuLog, setMenuLog] = useState<SymptomLog | null>(null);

  function handleDeleteLog(log: SymptomLog) {
    if (!session) return;
    Alert.alert(
      'Eliminar registro',
      '¿Seguro que deseas eliminar esta nota/síntoma?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSymptomLogRecord({
                familyId: session.family_id,
                symptomLogId: log.id,
              });
            } catch (err) {
              Alert.alert(
                'Error',
                err instanceof Error ? err.message : 'No se pudo eliminar el registro.'
              );
            }
          },
        },
      ]
    );
  }

  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const targetMemberForAdd =
    (filterId !== 'all' ? memberMap.get(filterId) : undefined) ??
    members.find((m) => m.id === selectedMemberId) ??
    members[0] ??
    null;

  const activityDateKeys = useMemo(() => {
    const set = new Set<string>();
    symptomLogs
      .filter((s) => filterId === 'all' || s.member_id === filterId)
      .forEach((s) => set.add(toDateKey(new Date(s.recorded_at))));
    return set;
  }, [symptomLogs, filterId]);

  const dayLogs = useMemo(() => {
    return symptomLogs
      .filter(
        (s) =>
          (filterId === 'all' || s.member_id === filterId) &&
          toDateKey(new Date(s.recorded_at)) === selectedDateKey
      )
      .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
  }, [symptomLogs, filterId, selectedDateKey]);

  const isTodaySelected = selectedDateKey === toDateKey(new Date());
  const accentColor =
    filterId !== 'all' ? memberMap.get(filterId)?.accent_color || colors.primary : colors.primary;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={typography.largeTitle}>Notas</Text>
            <Text style={styles.subtitle}>Síntomas, temperatura y observaciones</Text>
          </View>
          {isCaregiver && targetMemberForAdd && (
            <Pressable
              style={styles.addBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                router.push({
                  pathname: '/modals/add-symptom',
                  params: { memberId: targetMemberForAdd.id },
                });
              }}
            >
              <Ionicons name="add" size={18} color={colors.textInverse} />
              <Text style={styles.addBtnText}>Nota</Text>
            </Pressable>
          )}
        </View>

        {members.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterBleed}
            contentContainerStyle={styles.filterContent}
          >
            <Pressable
              style={[styles.filterChip, filterId === 'all' && styles.filterChipActive]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setFilterId('all');
              }}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filterId === 'all' && styles.filterChipTextActive,
                ]}
              >
                Toda la familia
              </Text>
            </Pressable>

            {members.map((m) => {
              const active = filterId === m.id;
              const accent = m.accent_color || colors.primary;
              return (
                <Pressable
                  key={m.id}
                  style={[
                    styles.filterChip,
                    active && { backgroundColor: accent, borderColor: accent },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setFilterId(m.id);
                  }}
                >
                  <View
                    style={[
                      styles.filterDot,
                      { backgroundColor: active ? colors.textInverse : accent },
                    ]}
                  />
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                    {m.display_name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <View style={styles.weekWrap}>
          <WeekStrip
            selectedDateKey={selectedDateKey}
            onSelectDateKey={setSelectedDateKey}
            activityDateKeys={activityDateKeys}
            accentColor={accentColor}
          />
        </View>

        <Text style={styles.sectionHeader}>
          {isTodaySelected ? 'Registros de hoy' : `Registros · ${selectedDateKey}`}
        </Text>

        {dayLogs.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={28} color={colors.textTertiary} />
            <Text style={styles.emptyText}>Sin notas ni síntomas registrados este día.</Text>
          </Card>
        ) : (
          dayLogs.map((log) => {
            const member = memberMap.get(log.member_id);
            const memberColor = member?.accent_color || colors.primary;
            const tempColor = getTemperatureColor(log.temperature_celsius);

            return (
              <Card key={log.id} style={styles.logCard}>
                <View style={styles.logTop}>
                  <View style={styles.memberTag}>
                    <View style={[styles.memberDot, { backgroundColor: memberColor }]} />
                    <Text style={[styles.memberName, { color: memberColor }]}>
                      {member?.display_name ?? 'Miembro'}
                    </Text>
                  </View>
                  <View style={styles.logTopRight}>
                    <Text style={[styles.timeText, typography.tabularNums]}>
                      {formatTimeShort(log.recorded_at)}
                    </Text>
                    {isCaregiver && (
                      <Pressable
                        style={styles.menuBtn}
                        hitSlop={8}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setMenuLog(log);
                        }}
                        accessibilityLabel="Opciones de nota"
                      >
                        <Ionicons
                          name="ellipsis-vertical"
                          size={16}
                          color={colors.textSecondary}
                        />
                      </Pressable>
                    )}
                  </View>
                </View>

                <View style={styles.badgesRow}>
                  {log.temperature_celsius !== null && (
                    <View style={[styles.tempBadge, { backgroundColor: `${tempColor}18` }]}>
                      <Ionicons name="thermometer" size={14} color={tempColor} />
                      <Text style={[styles.tempText, typography.tabularNums, { color: tempColor }]}>
                        {log.temperature_celsius.toFixed(1)} °C
                      </Text>
                    </View>
                  )}
                  {log.symptoms.map((sym) => (
                    <View key={sym} style={styles.symptomChip}>
                      <Text style={styles.symptomChipText}>{sym}</Text>
                    </View>
                  ))}
                </View>

                {log.notes && <Text style={styles.noteBody}>{log.notes}</Text>}

                <Text style={styles.recordedBy}>Registrado por {log.recorded_by_name}</Text>
              </Card>
            );
          })
        )}
        {/* Menú de opciones de nota/síntoma */}
        <Modal
          visible={Boolean(menuLog)}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuLog(null)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setMenuLog(null)}>
            <Pressable style={styles.menuCardWrapper} onPress={() => {}}>
              <Card style={styles.menuCard}>
                <Text style={styles.menuTitle}>
                  {menuLog ? memberMap.get(menuLog.member_id)?.display_name ?? 'Registro' : ''}
                  {menuLog ? ` · ${formatTimeShort(menuLog.recorded_at)}` : ''}
                </Text>

                <Pressable
                  style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                  onPress={() => {
                    const target = menuLog;
                    setMenuLog(null);
                    if (!target) return;
                    router.push({
                      pathname: '/modals/add-symptom',
                      params: { symptomLogId: target.id, memberId: target.member_id },
                    });
                  }}
                >
                  <Ionicons name="create-outline" size={20} color={colors.textPrimary} />
                  <Text style={styles.menuItemText}>Editar</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.menuItem,
                    styles.menuItemLast,
                    pressed && styles.menuItemPressed,
                  ]}
                  onPress={() => {
                    const target = menuLog;
                    setMenuLog(null);
                    if (target) handleDeleteLog(target);
                  }}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  <Text style={[styles.menuItemText, styles.menuItemDanger]}>Eliminar</Text>
                </Pressable>
              </Card>
            </Pressable>
          </Pressable>
        </Modal>
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
    paddingBottom: spacing.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.footnote,
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  addBtnText: {
    color: colors.textInverse,
    fontSize: 13,
    fontWeight: '700',
  },
  filterBleed: {
    marginHorizontal: -spacing.lg,
    marginBottom: spacing.md,
  },
  filterContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.textInverse,
  },
  weekWrap: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    ...typography.headline,
    fontSize: 16,
    marginBottom: spacing.sm + 2,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.subhead,
    color: colors.textTertiary,
  },
  logCard: {
    marginBottom: spacing.md,
  },
  logTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  memberTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  memberName: {
    fontSize: 13,
    fontWeight: '700',
  },
  logTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  menuBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  menuCardWrapper: {
    width: '100%',
  },
  menuCard: {
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  menuTitle: {
    ...typography.headline,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    marginBottom: spacing.xs,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
    borderRadius: radius.sm,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  menuItemText: {
    ...typography.body,
    fontWeight: '500',
  },
  menuItemDanger: {
    color: colors.danger,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    marginBottom: spacing.sm,
  },
  tempBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  tempText: {
    fontSize: 12,
    fontWeight: '700',
  },
  symptomChip: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  symptomChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  noteBody: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  recordedBy: {
    ...typography.caption,
  },
});
