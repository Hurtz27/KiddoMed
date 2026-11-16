import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useKiddoMed } from '../../context/KiddoMedContext';

export default function SettingsScreen() {
  const { session, isCaregiver, isOffline, signOutFamily } = useKiddoMed();

  function handleLogout() {
    Alert.alert(
      'Salir de esta familia',
      '¿Seguro que deseas desvincular este teléfono?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', style: 'destructive', onPress: signOutFamily },
      ]
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.label}>Familia activa</Text>
        <Text style={styles.value}>{session?.family_name ?? '-'}</Text>

        <Text style={styles.label}>Tu perfil en este teléfono</Text>
        <Text style={styles.value}>{session?.display_name ?? '-'}</Text>

        <Text style={styles.label}>Nivel de permisos</Text>
        <Text style={[styles.roleValue, !isCaregiver && { color: '#0284C7' }]}>
          {isCaregiver ? 'Cuidador (Administrador completo)' : 'Paciente (Solo visualización)'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Estado de sincronización (Firebase Firestore)</Text>
        <View style={styles.statusRow}>
          <Ionicons
            name={isOffline ? 'cloud-offline' : 'cloud-done'}
            size={20}
            color={isOffline ? '#DC2626' : '#16A34A'}
          />
          <Text style={styles.statusText}>
            {isOffline ? 'Sin conexión' : 'Conectado en tiempo real'}
          </Text>
        </View>
      </View>

      <Pressable style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={18} color="#DC2626" />
        <Text style={styles.logoutText}>Cambiar de familia o cuenta</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  label: { fontSize: 12, fontWeight: '600', color: '#64748B', marginTop: 10 },
  value: { fontSize: 17, fontWeight: '700', color: '#0F172A', marginTop: 2 },
  roleValue: { fontSize: 15, fontWeight: '700', color: '#15803D', marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  statusText: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: { color: '#DC2626', fontWeight: '700', fontSize: 14 },
});
