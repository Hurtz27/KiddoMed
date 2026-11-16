import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KiddoMedProvider, useKiddoMed } from '../context/KiddoMedContext';

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
        <ActivityIndicator size="large" color="#0284C7" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="modals/apply-dose"
        options={{ presentation: 'modal', headerShown: true, title: 'Marcar Administrada' }}
      />
      <Stack.Screen
        name="modals/add-treatment"
        options={{ presentation: 'modal', headerShown: true, title: 'Nuevo Elemento de Tratamiento' }}
      />
      <Stack.Screen
        name="modals/add-illness"
        options={{ presentation: 'modal', headerShown: true, title: 'Registrar Enfermedad' }}
      />
      <Stack.Screen
        name="modals/add-symptom"
        options={{ presentation: 'modal', headerShown: true, title: 'Fiebre y Síntomas' }}
      />
      <Stack.Screen
        name="modals/add-member"
        options={{ presentation: 'modal', headerShown: true, title: 'Agregar Miembro Familiar' }}
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
    backgroundColor: '#F8FAFC',
  },
});
