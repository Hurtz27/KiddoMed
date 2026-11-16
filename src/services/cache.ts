import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DoseLog,
  FamilyMember,
  FamilySession,
  Illness,
  SymptomLog,
  TreatmentItem,
} from '../types/database';

const SESSION_KEY = 'kiddomed_v2_session';
const CACHE_KEY = 'kiddomed_v2_cache';

export interface ReadCachePayload {
  members: FamilyMember[];
  illnesses: Illness[];
  treatments: TreatmentItem[];
  doseLogs: DoseLog[];
  symptomLogs: SymptomLog[];
  updatedAt: string;
}

export async function saveFamilySession(session: FamilySession): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function loadFamilySession(): Promise<FamilySession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as FamilySession) : null;
  } catch {
    return null;
  }
}

export async function clearFamilySession(): Promise<void> {
  await AsyncStorage.multiRemove([SESSION_KEY, CACHE_KEY]);
}

export async function saveReadCache(payload: ReadCachePayload): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Mejor esfuerzo para caché de lectura
  }
}

export async function loadReadCache(): Promise<ReadCachePayload | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as ReadCachePayload) : null;
  } catch {
    return null;
  }
}
