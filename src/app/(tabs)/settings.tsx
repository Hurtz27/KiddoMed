import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import React, { useState } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/ui/Card';
import { GroupedListRow } from '../../components/ui/GroupedListRow';
import { PillButton } from '../../components/ui/PillButton';
import { useKiddoMed } from '../../context/KiddoMedContext';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { FamilySession } from '../../types/database';
import { formatDateTimeShort } from '../../utils/formatting';

export default function SettingsScreen() {
  const router = useRouter();
  const {
    families,
    session,
    isCaregiver,
    isOffline,
    members,
    switchFamily,
    leaveFamily,
    notificationsEnabled,
    mutedMemberIds,
    setNotificationsEnabled,
    toggleMemberNotifications,
  } = useKiddoMed();
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateStatusMsg, setUpdateStatusMsg] = useState<string | null>(null);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const shortUpdateId = Updates.updateId ? Updates.updateId.slice(0, 8) : null;
  const updateCreatedLabel = Updates.createdAt
    ? formatDateTimeShort(Updates.createdAt.toISOString())
    : null;

  async function handleCheckForUpdate() {
    if (isCheckingUpdate) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    if (Platform.OS === 'web' || __DEV__ || !Updates.isEnabled) {
      setUpdateStatusMsg('Solo disponible en compilaciones instaladas (APK/IPA).');
      return;
    }

    setIsCheckingUpdate(true);
    setUpdateStatusMsg('Buscando actualizaciones...');
    try {
      const check = await Updates.checkForUpdateAsync();
      if (!check.isAvailable) {
        setUpdateStatusMsg('Ya tienes la última versión.');
        return;
      }

      setUpdateStatusMsg('Descargando nueva actualización...');
      const fetchResult = await Updates.fetchUpdateAsync();
      if (fetchResult.isNew) {
        setUpdateStatusMsg('Nueva versión lista. Reinicia para aplicar.');
        Alert.alert(
          'Actualización lista',
          'Se descargó una nueva versión. ¿Deseas reiniciar la app para aplicarla?',
          [
            { text: 'Después', style: 'cancel' },
            {
              text: 'Reiniciar ahora',
              onPress: () => {
                void Updates.reloadAsync();
              },
            },
          ]
        );
      } else {
        setUpdateStatusMsg('Ya tienes la última versión.');
      }
    } catch {
      setUpdateStatusMsg('No se pudo verificar actualizaciones.');
    } finally {
      setIsCheckingUpdate(false);
    }
  }

  function handleSelectFamily(familyId: string) {
    if (familyId === session?.family_id) return;
    Haptics.selectionAsync().catch(() => {});
    void switchFamily(familyId);
  }

  async function handleViewMembers(familyId: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (familyId !== session?.family_id) {
      await switchFamily(familyId);
    }
    router.push('/(tabs)/patients');
  }

  function handleLeaveFamily(target: FamilySession) {
    const isLast = families.length <= 1;
    Alert.alert(
      `Salir de ${target.family_name}`,
      isLast
        ? 'Es tu única familia vinculada. Si sales, volverás a la pantalla de inicio.'
        : '¿Seguro que deseas desvincular esta familia de este teléfono?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: () => {
            void leaveFamily(target.family_id);
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Text style={typography.largeTitle}>Familia</Text>
          <Pressable
            style={styles.addBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              router.push('/modals/add-family');
            }}
          >
            <Ionicons name="add" size={18} color={colors.textInverse} />
            <Text style={styles.addBtnText}>Familia</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>Mis Familias ({families.length})</Text>

        {families.map((family) => {
          const isActive = family.family_id === session?.family_id;
          const roleLabel =
            family.role === 'caregiver' ? 'Cuidador (Admin)' : 'Paciente (Lectura)';

          return (
            <Card
              key={family.family_id}
              style={[styles.familyCard, isActive && styles.familyCardActive]}
            >
              <Pressable
                style={styles.familyTopRow}
                onPress={() => handleSelectFamily(family.family_id)}
              >
                <View
                  style={[
                    styles.familyIconBadge,
                    isActive && styles.familyIconBadgeActive,
                  ]}
                >
                  <Ionicons
                    name={isActive ? 'home' : 'home-outline'}
                    size={20}
                    color={isActive ? colors.textInverse : colors.primary}
                  />
                </View>

                <View style={styles.familyInfo}>
                  <View style={styles.familyNameRow}>
                    <Text style={styles.familyName} numberOfLines={1}>
                      {family.family_name}
                    </Text>
                    {isActive && (
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>Activa</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.familyMeta} numberOfLines={1}>
                    {family.display_name} · {roleLabel}
                  </Text>
                  {isActive && (
                    <Text style={styles.familyMembersCount}>
                      {members.length}{' '}
                      {members.length === 1 ? 'miembro' : 'miembros'} en esta familia
                    </Text>
                  )}
                </View>
              </Pressable>

              <View style={styles.familyActionsRow}>
                {!isActive && (
                  <Pressable
                    style={styles.actionPill}
                    onPress={() => handleSelectFamily(family.family_id)}
                  >
                    <Ionicons name="swap-horizontal" size={15} color={colors.primary} />
                    <Text style={styles.actionPillText}>Cambiar a esta</Text>
                  </Pressable>
                )}

                <Pressable
                  style={styles.actionPill}
                  onPress={() => void handleViewMembers(family.family_id)}
                >
                  <Ionicons name="people-outline" size={15} color={colors.primary} />
                  <Text style={styles.actionPillText}>Ver miembros</Text>
                </Pressable>

                <Pressable
                  style={[styles.actionPill, styles.leavePill]}
                  onPress={() => handleLeaveFamily(family)}
                >
                  <Ionicons name="log-out-outline" size={15} color={colors.danger} />
                  <Text style={[styles.actionPillText, styles.leavePillText]}>Salir</Text>
                </Pressable>
              </View>
            </Card>
          );
        })}

        <Text style={styles.sectionLabel}>Cuenta y Perfil Activo</Text>
        <Card style={styles.groupedCard}>
          <GroupedListRow
            title="Familia activa"
            rightText={session?.family_name ?? '-'}
            icon="home"
            iconBg={colors.primary}
            iconColor={colors.textInverse}
          />
          <GroupedListRow
            title="Tu perfil"
            rightText={session?.display_name ?? '-'}
            icon="person"
            iconBg="#AF52DE"
            iconColor={colors.textInverse}
          />
          <GroupedListRow
            title="Nivel de permisos"
            rightText={isCaregiver ? 'Cuidador (Admin)' : 'Paciente (Lectura)'}
            rightTextColor={isCaregiver ? colors.successText : colors.primary}
            icon="shield-checkmark"
            iconBg={colors.success}
            iconColor={colors.textInverse}
            showDivider={false}
          />
        </Card>

        <Text style={styles.sectionLabel}>Notificaciones</Text>
        <Card style={styles.groupedCard}>
          <View style={styles.switchRow}>
            <View style={[styles.switchIconWrap, { backgroundColor: colors.primary }]}>
              <Ionicons name="notifications" size={18} color={colors.textInverse} />
            </View>
            <View style={styles.switchInfo}>
              <Text style={styles.switchTitle}>Recordatorios de dosis</Text>
              <Text style={styles.switchSub}>
                {notificationsEnabled
                  ? 'Activos en este dispositivo'
                  : 'Desactivados en este dispositivo'}
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={(val) => {
                Haptics.selectionAsync().catch(() => {});
                void setNotificationsEnabled(val);
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>

          {notificationsEnabled && members.length > 0 && (
            <>
              <View style={styles.switchSectionDivider} />
              <Text style={styles.memberNotifHeader}>Por miembro familiar</Text>
              {members.map((m, idx) => {
                const isMemberEnabled = !mutedMemberIds.includes(m.id);
                const dotColor = m.accent_color || colors.primary;
                return (
                  <View key={m.id}>
                    <View style={styles.switchRow}>
                      <View style={[styles.memberNotifDot, { backgroundColor: dotColor }]} />
                      <View style={styles.switchInfo}>
                        <Text style={styles.switchTitle}>{m.display_name}</Text>
                      </View>
                      <Switch
                        value={isMemberEnabled}
                        onValueChange={(val) => {
                          Haptics.selectionAsync().catch(() => {});
                          void toggleMemberNotifications(m.id, val);
                        }}
                        trackColor={{ false: colors.border, true: dotColor }}
                        thumbColor={colors.surface}
                      />
                    </View>
                    {idx < members.length - 1 && <View style={styles.switchItemDivider} />}
                  </View>
                );
              })}
            </>
          )}
        </Card>

        <Text style={styles.sectionLabel}>Sincronización</Text>
        <Card style={styles.groupedCard}>
          <GroupedListRow
            title="Firebase Firestore"
            subtitle={isOffline ? 'Trabajando con caché local' : 'Sincronizado en tiempo real'}
            rightText={isOffline ? 'Sin conexión' : 'En línea'}
            rightTextColor={isOffline ? colors.dangerText : colors.successText}
            icon={isOffline ? 'cloud-offline' : 'cloud-done'}
            iconBg={isOffline ? colors.danger : colors.success}
            iconColor={colors.textInverse}
            showDivider={false}
          />
        </Card>

        <Text style={styles.sectionLabel}>Versión de la App</Text>
        <Card style={styles.groupedCard}>
          <View style={styles.appBrandRow}>
            <Image
              source={require('../../../assets/icon.png')}
              style={styles.appBrandLogo}
              accessibilityLabel="Logo de HL KiddoMed"
            />
            <View style={styles.appBrandInfo}>
              <Text style={styles.appBrandName}>HL KiddoMed</Text>
              <Text style={styles.appBrandSub}>
                Historial médico y tratamientos familiares
              </Text>
            </View>
          </View>
          <View style={styles.appBrandDivider} />
          <GroupedListRow
            title="Versión instalada"
            subtitle={
              Updates.channel
                ? `Canal: ${Updates.channel}`
                : __DEV__
                  ? 'Modo desarrollo'
                  : 'Compilación local'
            }
            rightText={`v${appVersion}`}
            icon="information-circle"
            iconBg={colors.primary}
            iconColor={colors.textInverse}
          />
          <GroupedListRow
            title="Actualización OTA"
            subtitle={
              Updates.isEnabled
                ? shortUpdateId
                  ? `Publicado: ${updateCreatedLabel ?? 'Fecha desconocida'}${
                      Updates.isEmbeddedLaunch ? ' (integrada)' : ''
                    }`
                  : Updates.isEmbeddedLaunch
                    ? 'Versión integrada en el binario'
                    : 'Sin ID de actualización'
                : __DEV__
                  ? 'Desactivado en modo desarrollo'
                  : 'No disponible en este entorno'
            }
            rightText={
              shortUpdateId ??
              (Updates.isEnabled
                ? Updates.runtimeVersion
                  ? `RT ${Updates.runtimeVersion}`
                  : 'Integrada'
                : 'Local')
            }
            icon="git-commit"
            iconBg="#5856D6"
            iconColor={colors.textInverse}
          />
          <GroupedListRow
            title={isCheckingUpdate ? 'Buscando actualización...' : 'Buscar actualizaciones'}
            subtitle={updateStatusMsg ?? 'Toca para verificar si hay una versión nueva'}
            rightText={isCheckingUpdate ? '...' : 'Verificar'}
            rightTextColor={colors.primary}
            icon="refresh"
            iconBg="#0EA5E9"
            iconColor={colors.textInverse}
            showDivider={false}
            onPress={() => void handleCheckForUpdate()}
          />
        </Card>

        <PillButton
          label="Agregar otra familia"
          icon="add-circle-outline"
          variant="primary"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            router.push('/modals/add-family');
          }}
          style={styles.addFamilyBtn}
        />
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
    marginBottom: spacing.lg,
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
    fontSize: 14,
    fontWeight: '700',
  },
  sectionLabel: {
    ...typography.footnote,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  familyCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
  },
  familyCardActive: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  familyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  familyIconBadge: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  familyIconBadgeActive: {
    backgroundColor: colors.primary,
  },
  familyInfo: {
    flex: 1,
  },
  familyNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  familyName: {
    ...typography.headline,
    flexShrink: 1,
  },
  activeBadge: {
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.successText,
  },
  familyMeta: {
    ...typography.footnote,
    color: colors.textSecondary,
    marginTop: 2,
  },
  familyMembersCount: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  familyActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
  },
  actionPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  leavePill: {
    backgroundColor: colors.dangerSoft,
    marginLeft: 'auto',
  },
  leavePillText: {
    color: colors.danger,
  },
  groupedCard: {
    paddingVertical: spacing.xs,
    borderRadius: radius.xl,
    marginBottom: spacing.xl,
  },
  appBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  appBrandLogo: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
  },
  appBrandInfo: {
    flex: 1,
  },
  appBrandName: {
    ...typography.headline,
  },
  appBrandSub: {
    ...typography.footnote,
    color: colors.textSecondary,
    marginTop: 2,
  },
  appBrandDivider: {
    height: 0.5,
    backgroundColor: colors.border,
    marginLeft: 44 + spacing.md,
  },
  addFamilyBtn: {
    marginTop: spacing.xs,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  switchIconWrap: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchInfo: {
    flex: 1,
  },
  switchTitle: {
    ...typography.body,
    color: colors.textPrimary,
  },
  switchSub: {
    ...typography.footnote,
    color: colors.textSecondary,
    marginTop: 1,
  },
  switchSectionDivider: {
    height: 0.5,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  switchItemDivider: {
    height: 0.5,
    backgroundColor: colors.border,
    marginLeft: 26,
  },
  memberNotifHeader: {
    ...typography.footnote,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: colors.textTertiary,
    marginTop: spacing.xs,
    marginBottom: 2,
  },
  memberNotifDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: 9,
  },
});
