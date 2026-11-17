import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KiddoMedProvider, useKiddoMed } from '../context/KiddoMedContext';
import { colors } from '../theme/tokens';

const STACK_HEADER_OPTIONS = {
  headerShown: true,
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.primary,
  headerTitleStyle: {
    fontWeight: '700' as const,
    fontSize: 17,
    color: colors.textPrimary,
  },
};

const MODAL_HEADER_OPTIONS = {
  ...STACK_HEADER_OPTIONS,
  presentation: 'modal' as const,
};

function NavigationGuard() {
  const { isReady, session } = useKiddoMed();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) return;
    const inOnboarding = segments[0] === 'onboarding';

    if (!session && !inOnboarding) {
      router.replace('/onboarding');
    } else if (session && inOnboarding) {
      router.replace('/(tabs)');
    }
  }, [isReady, session, segments, router]);

  if (!isReady) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="member-illnesses"
        options={{ ...STACK_HEADER_OPTIONS, title: 'Historial de Enfermedades' }}
      />
      <Stack.Screen
        name="illness-detail"
        options={{ ...STACK_HEADER_OPTIONS, title: 'Detalle de Enfermedad' }}
      />
      <Stack.Screen
        name="modals/apply-dose"
        options={{ ...MODAL_HEADER_OPTIONS, title: 'Marcar Administrada' }}
      />
      <Stack.Screen
        name="modals/add-treatment"
        options={{ ...MODAL_HEADER_OPTIONS, title: 'Nuevo Tratamiento' }}
      />
      <Stack.Screen
        name="modals/add-illness"
        options={{ ...MODAL_HEADER_OPTIONS, title: 'Registrar Enfermedad' }}
      />
      <Stack.Screen
        name="modals/add-symptom"
        options={{ ...MODAL_HEADER_OPTIONS, title: 'Fiebre y Síntomas' }}
      />
      <Stack.Screen
        name="modals/add-member"
        options={{ ...MODAL_HEADER_OPTIONS, title: 'Agregar Miembro' }}
      />
      <Stack.Screen
        name="modals/add-family"
        options={{ ...MODAL_HEADER_OPTIONS, title: 'Agregar Familia' }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <KiddoMedProvider>
        <StatusBar style="dark" />
        <NavigationGuard />
      </KiddoMedProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
