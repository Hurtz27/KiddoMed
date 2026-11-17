import { useRouter } from 'expo-router';
import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { FamilyAccessForm } from '../../components/FamilyAccessForm';
import { useKiddoMed } from '../../context/KiddoMedContext';
import { colors, spacing, typography } from '../../theme/tokens';
import { FamilySession } from '../../types/database';

export default function AddFamilyModal() {
  const router = useRouter();
  const { addOrSelectFamily } = useKiddoMed();

  async function handleSuccess(newSession: FamilySession) {
    await addOrSelectFamily(newSession);
    router.back();
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.description}>
          Crea una nueva familia o únete a una existente con un código de invitación. Podrás
          cambiar entre tus familias en cualquier momento.
        </Text>

        <FamilyAccessForm
          onSuccess={handleSuccess}
          createButtonLabel="Crear y Agregar Familia"
          joinButtonLabel="Unirme a esta Familia"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  description: {
    ...typography.subhead,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
});
