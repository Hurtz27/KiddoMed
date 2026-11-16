import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKiddoMed } from '../context/KiddoMedContext';
import { isFirebaseConfigured } from '../lib/firebase';
import { createFamilyAccount, joinFamilyByInviteCode } from '../services/kiddomed';
import { RelationshipType } from '../types/database';

const RELATIONSHIPS: { label: string; value: RelationshipType }[] = [
  { label: 'Padre', value: 'padre' },
  { label: 'Madre', value: 'madre' },
  { label: 'Hijo', value: 'hijo' },
  { label: 'Hija', value: 'hija' },
  { label: 'Abuelo', value: 'abuelo' },
  { label: 'Abuela', value: 'abuela' },
  { label: 'Otro', value: 'otro' },
];

export default function OnboardingScreen() {
  const { setSession } = useKiddoMed();
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
      setSession(session);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo completar el acceso.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.iconBadge}>
              <Ionicons name="medkit" size={36} color="#0284C7" />
            </View>
            <Text style={styles.title}>HL KiddoMed</Text>
            <Text style={styles.subtitle}>
              Historial médico y tratamientos familiares sincronizados en tiempo real.
            </Text>
          </View>

          {!isFirebaseConfigured && (
            <View style={styles.warningBox}>
              <Ionicons name="warning" size={20} color="#B45309" />
              <Text style={styles.warningText}>
                Falta configurar el archivo .env con las credenciales de tu proyecto Firebase.
              </Text>
            </View>
          )}

          <View style={styles.segmented}>
            <Pressable
              style={[styles.segBtn, mode === 'create' && styles.segBtnActive]}
              onPress={() => setMode('create')}
            >
              <Text style={[styles.segText, mode === 'create' && styles.segTextActive]}>
                Crear Familia
              </Text>
            </Pressable>
            <Pressable
              style={[styles.segBtn, mode === 'join' && styles.segBtnActive]}
              onPress={() => setMode('join')}
            >
              <Text style={[styles.segText, mode === 'join' && styles.segTextActive]}>
                Tengo Invitación
              </Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            {mode === 'create' ? (
              <>
                <Text style={styles.label}>Nombre de la familia *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej. Familia Hurtado"
                  value={familyName}
                  onChangeText={setFamilyName}
                  autoCapitalize="words"
                />

                <Text style={styles.label}>Tu nombre (se creará tu perfil automáticamente) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej. Martín H."
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoCapitalize="words"
                />

                <Text style={styles.label}>Tu parentesco</Text>
                <View style={styles.chipRow}>
                  {RELATIONSHIPS.map((r) => {
                    const active = relationship === r.value;
                    return (
                      <Pressable
                        key={r.value}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setRelationship(r.value)}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {r.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.label}>Código de invitación *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej. FAM-NORELY-4821"
                  value={inviteCode}
                  onChangeText={(t) => setInviteCode(t.toUpperCase())}
                  autoCapitalize="characters"
                />
                <Text style={styles.helperText}>
                  El administrador de tu familia puede generar este código desde la pestaña Miembros.
                </Text>
              </>
            )}

            <Pressable
              style={[styles.submitBtn, loading && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitText}>
                  {mode === 'create' ? 'Crear Familia y Entrar' : 'Entrar con Invitación'}
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { padding: 24, paddingTop: 28 },
  header: { alignItems: 'center', marginBottom: 22 },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 28, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 14, color: '#475569', textAlign: 'center', marginTop: 6, lineHeight: 20 },
  warningBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  warningText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 17 },
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 4,
    marginBottom: 18,
  },
  segBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 9 },
  segBtnActive: { backgroundColor: '#FFFFFF' },
  segText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  segTextActive: { color: '#0284C7' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  chipActive: { backgroundColor: '#0284C7', borderColor: '#0284C7' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  chipTextActive: { color: '#FFFFFF' },
  helperText: { fontSize: 12, color: '#64748B', marginTop: 8, lineHeight: 17 },
  submitBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 22,
  },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
