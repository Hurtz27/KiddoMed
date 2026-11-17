import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DoseLog,
  FamilyMember,
  FamilySession,
  Illness,
  SymptomLog,
  TreatmentItem,
} from '../types/database';

const LEGACY_SESSION_KEY = 'kiddomed_v2_session';
const LEGACY_CACHE_KEY = 'kiddomed_v2_cache';
const FAMILIES_KEY = 'kiddomed_v2_families';
const ACTIVE_FAMILY_KEY = 'kiddomed_v2_active_family_id';
const FAMILY_CACHE_PREFIX = 'kiddomed_v2_cache_';

export interface ReadCachePayload {
  members: FamilyMember[];
  illnesses: Illness[];
  treatments: TreatmentItem[];
  doseLogs: DoseLog[];
  symptomLogs: SymptomLog[];
  updatedAt: string;
}

export interface FamiliesStorageState {
  families: FamilySession[];
  activeFamilyId: string | null;
}

function getFamilyCacheKey(familyId: string): string {
  return `${FAMILY_CACHE_PREFIX}${familyId}`;
}

export async function loadFamiliesState(): Promise<FamiliesStorageState> {
  try {
    const [rawFamilies, rawActiveId] = await AsyncStorage.multiGet([
      FAMILIES_KEY,
      ACTIVE_FAMILY_KEY,
    ]);

    const familiesJson = rawFamilies[1];
    const activeId = rawActiveId[1];

    if (familiesJson) {
      const families = JSON.parse(familiesJson) as FamilySession[];
      const validActive =
        activeId && families.some((f) => f.family_id === activeId)
          ? activeId
          : families[0]?.family_id ?? null;
      return { families, activeFamilyId: validActive };
    }

    // Migración automática desde sesión única previa
    const legacyRaw = await AsyncStorage.getItem(LEGACY_SESSION_KEY);
    if (legacyRaw) {
      const legacySession = JSON.parse(legacyRaw) as FamilySession;
      const families = [legacySession];
      const activeFamilyId = legacySession.family_id;
      await saveFamiliesState(families, activeFamilyId);

      const legacyCache = await AsyncStorage.getItem(LEGACY_CACHE_KEY);
      if (legacyCache) {
        await AsyncStorage.setItem(getFamilyCacheKey(activeFamilyId), legacyCache);
      }
      await AsyncStorage.multiRemove([LEGACY_SESSION_KEY, LEGACY_CACHE_KEY]);
      return { families, activeFamilyId };
    }

    return { families: [], activeFamilyId: null };
  } catch {
    return { families: [], activeFamilyId: null };
  }
}

export async function saveFamiliesState(
  families: FamilySession[],
  activeFamilyId: string | null
): Promise<void> {
  const ops: [string, string][] = [[FAMILIES_KEY, JSON.stringify(families)]];
  if (activeFamilyId) {
    ops.push([ACTIVE_FAMILY_KEY, activeFamilyId]);
    await AsyncStorage.multiSet(ops);
  } else {
    await AsyncStorage.setItem(FAMILIES_KEY, JSON.stringify(families));
    await AsyncStorage.removeItem(ACTIVE_FAMILY_KEY);
  }
}

export async function upsertFamilySession(
  session: FamilySession
): Promise<FamiliesStorageState> {
  const current = await loadFamiliesState();
  const exists = current.families.some((f) => f.family_id === session.family_id);
  const nextFamilies = exists
    ? current.families.map((f) => (f.family_id === session.family_id ? session : f))
    : [...current.families, session];
  const nextActiveId = session.family_id;
  await saveFamiliesState(nextFamilies, nextActiveId);
  return { families: nextFamilies, activeFamilyId: nextActiveId };
}

export async function setActiveFamilyIdInStorage(familyId: string): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_FAMILY_KEY, familyId);
}

export async function removeFamilyFromStorage(
  familyId: string
): Promise<FamiliesStorageState> {
  const current = await loadFamiliesState();
  const nextFamilies = current.families.filter((f) => f.family_id !== familyId);
  const nextActiveId =
    current.activeFamilyId === familyId
      ? nextFamilies[0]?.family_id ?? null
      : current.activeFamilyId;

  await saveFamiliesState(nextFamilies, nextActiveId);
  await AsyncStorage.removeItem(getFamilyCacheKey(familyId)).catch(() => {});
  return { families: nextFamilies, activeFamilyId: nextActiveId };
}

export async function saveFamilySession(session: FamilySession): Promise<void> {
  await upsertFamilySession(session);
}

export async function saveReadCache(
  familyId: string,
  payload: ReadCachePayload
): Promise<void> {
  try {
    await AsyncStorage.setItem(getFamilyCacheKey(familyId), JSON.stringify(payload));
  } catch {
    // Mejor esfuerzo para caché de lectura
  }
}

export async function loadReadCache(familyId: string): Promise<ReadCachePayload | null> {
  try {
    const raw = await AsyncStorage.getItem(getFamilyCacheKey(familyId));
    return raw ? (JSON.parse(raw) as ReadCachePayload) : null;
  } catch {
    return null;
  }
}
