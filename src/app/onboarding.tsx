import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FamilyAccessForm } from '../components/FamilyAccessForm';
import { useKiddoMed } from '../context/KiddoMedContext';
import { colors, radius, spacing, typography } from '../theme/tokens';

export default function OnboardingScreen() {
  const { addOrSelectFamily } = useKiddoMed();

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.iconBadge}>
              <Ionicons name="medkit" size={34} color={colors.primary} />
            </View>
            <Text style={typography.largeTitle}>HL KiddoMed</Text>
            <Text style={styles.subtitle}>
              Historial médico y tratamientos familiares sincronizados en tiempo real.
            </Text>
          </View>

          <FamilyAccessForm onSuccess={addOrSelectFamily} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.xl,
    paddingTop: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.subhead,
    textAlign: 'center',
    marginTop: spacing.xs + 2,
    lineHeight: 20,
  },
});
