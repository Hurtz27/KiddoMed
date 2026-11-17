import React, { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { isFirebaseConfigured } from '../lib/firebase';
import { createFamilyAccount, joinFamilyByInviteCode } from '../services/kiddomed';
import { colors, spacing, typography } from '../theme/tokens';
import { FamilySession, RelationshipType } from '../types/database';
import { Card } from './ui/Card';
import { ChipGroup, ChipOption } from './ui/ChipGroup';
import { FormField } from './ui/FormField';
import { PillButton } from './ui/PillButton';
import { SegmentedControl } from './ui/SegmentedControl';
import { StatusBanner } from './ui/StatusBanner';

const RELATIONSHIPS: ChipOption<RelationshipType>[] = [
  { label: 'Padre', value: 'padre' },
  { label: 'Madre', value: 'madre' },
  { label: 'Hijo', value: 'hijo' },
  { label: 'Hija', value: 'hija' },
  { label: 'Abuelo', value: 'abuelo' },
  { label: 'Abuela', value: 'abuela' },
  { label: 'Otro', value: 'otro' },
];

const MODE_OPTIONS = [
  { label: 'Crear Familia', value: 'create' as const },
  { label: 'Tengo Invitación', value: 'join' as const },
];

interface FamilyAccessFormProps {
  onSuccess: (session: FamilySession) => Promise<void> | void;
  createButtonLabel?: string;
  joinButtonLabel?: string;
}

export function FamilyAccessForm({
  onSuccess,
  createButtonLabel = 'Crear Familia y Entrar',
  joinButtonLabel = 'Entrar con Invitación',
}: FamilyAccessFormProps) {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [familyName, setFamilyName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [relationship, setRelationship] = useState<RelationshipType>('padre');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!isFirebaseConfigured) {
      Alert.alert(
        'Falta configurar Firebase',
        'Agrega las variables EXPO_PUBLIC_FIREBASE_* en tu archivo .env.'
      );
      return;
    }

    if (mode === 'create') {
      if (!familyName.trim() || !displayName.trim()) {
        Alert.alert('Campos requeridos', 'Ingresa el nombre de tu familia y tu nombre.');
        return;
      }
    } else if (!inviteCode.trim()) {
      Alert.alert('Código requerido', 'Ingresa el código de invitación que te compartieron.');
      return;
    }

    setLoading(true);
    try {
      const session =
        mode === 'create'
          ? await createFamilyAccount({ familyName, displayName, relationship })
          : await joinFamilyByInviteCode(inviteCode);
      await onSuccess(session);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo completar el acceso.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {!isFirebaseConfigured && (
        <StatusBanner
          tone="warning"
          icon="warning"
          message="Falta configurar el archivo .env con las credenciales de tu proyecto Firebase."
          style={styles.bannerSpacing}
        />
      )}

      <SegmentedControl
        options={MODE_OPTIONS}
        value={mode}
        onChange={setMode}
        style={styles.segmented}
      />

      <Card>
        {mode === 'create' ? (
          <>
            <FormField
              label="Nombre de la familia *"
              placeholder="Ej. Familia Hurtado"
              value={familyName}
              onChangeText={setFamilyName}
              autoCapitalize="words"
            />

            <FormField
              label="Tu nombre (se creará tu perfil) *"
              placeholder="Ej. Martín H."
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
            />

            <Text style={styles.chipLabel}>Tu parentesco</Text>
            <ChipGroup
              options={RELATIONSHIPS}
              value={relationship}
              onChange={setRelationship}
            />
          </>
        ) : (
          <FormField
            label="Código de invitación *"
            placeholder="Ej. FAM-NORELY-4821"
            value={inviteCode}
            onChangeText={(t) => setInviteCode(t.toUpperCase())}
            autoCapitalize="characters"
            hint="El administrador de tu familia puede generar este código desde la pestaña Miembros."
          />
        )}

        <PillButton
          label={mode === 'create' ? createButtonLabel : joinButtonLabel}
          loading={loading}
          onPress={handleSubmit}
          style={styles.submitBtn}
        />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  bannerSpacing: {
    marginBottom: spacing.lg,
  },
  segmented: {
    marginBottom: spacing.lg,
  },
  chipLabel: {
    ...typography.subhead,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  submitBtn: {
    marginTop: spacing.xl,
  },
});
