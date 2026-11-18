import {
  collection,
  disableNetwork,
  enableNetwork,
  getDocsFromServer,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { db, isFirebaseConfigured } from '../lib/firebase';
import {
  loadFamiliesState,
  loadReadCache,
  removeFamilyFromStorage,
  saveReadCache,
  setActiveFamilyIdInStorage,
  upsertFamilySession,
} from '../services/cache';
import { ensureAnonymousAuth } from '../services/kiddomed';
import {
  getNotificationPrefs,
  initializeNotifications,
  saveNotificationPrefs,
  syncPrescriptionReminders,
} from '../services/notifications';
import {
  DoseLog,
  FamilyMember,
  FamilySession,
  Illness,
  SymptomLog,
  TreatmentItem,
} from '../types/database';

export type SyncStatus = 'connecting' | 'online' | 'reconnecting' | 'error';

interface KiddoMedContextValue {
  isReady: boolean;
  isOffline: boolean;
  syncStatus: SyncStatus;
  families: FamilySession[];
  session: FamilySession | null;
  isCaregiver: boolean;
  members: FamilyMember[];
  illnesses: Illness[];
  treatments: TreatmentItem[];
  doseLogs: DoseLog[];
  symptomLogs: SymptomLog[];
  selectedMemberId: string | null;
  setSelectedMemberId: (id: string | null) => void;
  setSession: (session: FamilySession | null) => void;
  addOrSelectFamily: (session: FamilySession) => Promise<void>;
  switchFamily: (familyId: string) => Promise<void>;
  leaveFamily: (familyId: string) => Promise<void>;
  signOutFamily: () => Promise<void>;
  notificationsEnabled: boolean;
  mutedMemberIds: string[];
  notificationAdvanceMinutes: number;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  toggleMemberNotifications: (memberId: string, enabled: boolean) => Promise<void>;
  setNotificationAdvanceMinutes: (minutes: number) => Promise<void>;
  syncError: string | null;
  retrySync: () => void;
}

const KiddoMedContext = createContext<KiddoMedContextValue | null>(null);

function formatSyncError(err: unknown): { status: 'reconnecting' | 'error'; message: string } {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const lower = raw.toLowerCase();

  if (lower.includes('permission-denied') || lower.includes('insufficient permissions')) {
    return {
      status: 'error',
      message: 'Sin permisos de sincronización. Vuelve a unirte con tu código de invitación.',
    };
  }

  if (
    lower.includes('unavailable') ||
    lower.includes('network') ||
    lower.includes('offline') ||
    lower.includes('failed to fetch') ||
    lower.includes('deadline-exceeded')
  ) {
    return {
      status: 'reconnecting',
      message: 'Sin conexión a internet. Esperando reconexión...',
    };
  }

  return {
    status: 'reconnecting',
    message: raw ? `Error de conexión (${raw}). Esperando reconexión...` : 'Sin conexión. Esperando reconexión...',
  };
}

export function KiddoMedProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('connecting');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncTick, setSyncTick] = useState(0);

  const retrySync = useCallback(() => {
    setSyncStatus('connecting');
    setSyncError('Reconectando con el servidor...');
    setSyncTick((t) => t + 1);
  }, []);

  const [families, setFamilies] = useState<FamilySession[]>([]);
  const [activeFamilyId, setActiveFamilyId] = useState<string | null>(null);

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [illnesses, setIllnesses] = useState<Illness[]>([]);
  const [treatments, setTreatments] = useState<TreatmentItem[]>([]);
  const [doseLogs, setDoseLogs] = useState<DoseLog[]>([]);
  const [symptomLogs, setSymptomLogs] = useState<SymptomLog[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);
  const [mutedMemberIds, setMutedMemberIds] = useState<string[]>([]);
  const [notificationAdvanceMinutes, setNotificationAdvanceMinutesState] = useState(0);

  const session = useMemo(
    () => families.find((f) => f.family_id === activeFamilyId) ?? families[0] ?? null,
    [families, activeFamilyId]
  );

  const applyCachedFamilyData = useCallback(async (familyId: string | null) => {
    if (!familyId) {
      setMembers([]);
      setIllnesses([]);
      setTreatments([]);
      setDoseLogs([]);
      setSymptomLogs([]);
      setSelectedMemberId(null);
      return;
    }

    const cached = await loadReadCache(familyId);
    if (cached) {
      setMembers(cached.members);
      setIllnesses(cached.illnesses);
      setTreatments(cached.treatments);
      setDoseLogs(cached.doseLogs);
      setSymptomLogs(cached.symptomLogs);
      setSelectedMemberId(cached.members[0]?.id ?? null);
    } else {
      setMembers([]);
      setIllnesses([]);
      setTreatments([]);
      setDoseLogs([]);
      setSymptomLogs([]);
      setSelectedMemberId(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function bootstrap() {
      const [prefs, stored] = await Promise.all([
        getNotificationPrefs(),
        loadFamiliesState(),
      ]);
      if (prefs.enabled) {
        await initializeNotifications();
      }
      const cached = stored.activeFamilyId
        ? await loadReadCache(stored.activeFamilyId)
        : null;

      if (!mounted) return;

      setNotificationsEnabledState(prefs.enabled);
      setMutedMemberIds(prefs.mutedMemberIds);
      setNotificationAdvanceMinutesState(prefs.advanceMinutes);
      setFamilies(stored.families);
      setActiveFamilyId(stored.activeFamilyId);

      if (cached) {
        setMembers(cached.members);
        setIllnesses(cached.illnesses);
        setTreatments(cached.treatments);
        setDoseLogs(cached.doseLogs);
        setSymptomLogs(cached.symptomLogs);
        if (cached.members[0]) {
          setSelectedMemberId(cached.members[0].id);
        }
      }

      setIsReady(true);
    }
    void bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  // Reprogramar recordatorios locales cuando cambien tratamientos, miembros o preferencias
  useEffect(() => {
    if (!isReady) return;
    void syncPrescriptionReminders({
      treatments,
      members,
      enabled: notificationsEnabled,
      mutedMemberIds,
      advanceMinutes: notificationAdvanceMinutes,
    });
  }, [isReady, members, treatments, notificationsEnabled, mutedMemberIds, notificationAdvanceMinutes]);

  // Guardar caché de lectura ante cambios de la familia activa
  useEffect(() => {
    if (!isReady || !session) return;
    void saveReadCache(session.family_id, {
      members,
      illnesses,
      treatments,
      doseLogs,
      symptomLogs,
      updatedAt: new Date().toISOString(),
    });
  }, [isReady, session, members, illnesses, treatments, doseLogs, symptomLogs]);

  // Reintentar sincronización automáticamente al volver a primer plano si hubo fallo de red
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && (isOffline || syncError)) {
        setSyncTick((t) => t + 1);
      }
    });
    return () => sub.remove();
  }, [isOffline, syncError]);

  // Listeners en tiempo real de Firestore para la familia activa
  const activeSessionFamilyId = session?.family_id ?? null;

  useEffect(() => {
    if (!activeSessionFamilyId || !isFirebaseConfigured) return;

    const currentFamilyId = activeSessionFamilyId;
    let unsubs: (() => void)[] = [];
    let cancelled = false;
    let serverConfirmed = false;
    let stage: 'auth' | 'firestore' = 'auth';

    const connectTimer = setTimeout(() => {
      if (!cancelled && !serverConfirmed) {
        setIsOffline(true);
        setSyncStatus('reconnecting');
        setSyncError(
          stage === 'auth'
            ? 'Sin respuesta al autenticar con Firebase. Esperando reconexión...'
            : 'No hay conexión o Firestore no responde. Esperando reconexión...'
        );
      }
    }, 6000);

    const markOnline = () => {
      serverConfirmed = true;
      clearTimeout(connectTimer);
      setIsOffline(false);
      setSyncStatus('online');
      setSyncError(null);
    };

    const handleSnapshotError = (err: Error) => {
      if (cancelled) return;
      clearTimeout(connectTimer);
      const formatted = formatSyncError(err);
      setIsOffline(true);
      setSyncStatus(formatted.status);
      setSyncError(formatted.message);
    };

    async function subscribe() {
      try {
        if (syncTick > 0) {
          // Forzar reinicio del transporte de Firestore al cambiar de red (ej. datos -> Wi-Fi)
          await disableNetwork(db).catch(() => {});
          await enableNetwork(db).catch(() => {});
          if (cancelled) return;
        }

        await ensureAnonymousAuth();
        if (cancelled) return;

        stage = 'firestore';
        const base = `families/${currentFamilyId}`;

        const qMembers = query(collection(db, `${base}/members`), orderBy('created_at', 'asc'));
        const qIllnesses = query(collection(db, `${base}/illnesses`), orderBy('diagnosed_at', 'desc'));
        const qTreatments = query(collection(db, `${base}/treatments`), orderBy('created_at', 'desc'));
        const qDoses = query(collection(db, `${base}/dose_logs`), orderBy('administered_at', 'desc'));
        const qSymptoms = query(collection(db, `${base}/symptom_logs`), orderBy('recorded_at', 'desc'));

        const unsubMembers = onSnapshot(
          qMembers,
          { includeMetadataChanges: true },
          (snap) => {
            if (!(snap.metadata.fromCache && snap.empty)) {
              const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FamilyMember);
              setMembers(list);
              setSelectedMemberId((prev) =>
                prev && list.some((m) => m.id === prev) ? prev : list[0]?.id ?? null
              );
            }

            if (!snap.metadata.fromCache) {
              markOnline();
            } else if (serverConfirmed) {
              setIsOffline(true);
              setSyncStatus('reconnecting');
              setSyncError('Conexión interrumpida. Esperando reconexión...');
            }
          },
          handleSnapshotError
        );

        const unsubIllnesses = onSnapshot(
          qIllnesses,
          (snap) => {
            if (snap.metadata.fromCache && snap.empty) return;
            setIllnesses(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Illness));
          },
          handleSnapshotError
        );

        const unsubTreatments = onSnapshot(
          qTreatments,
          (snap) => {
            if (snap.metadata.fromCache && snap.empty) return;
            setTreatments(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TreatmentItem));
          },
          handleSnapshotError
        );

        const unsubDoses = onSnapshot(
          qDoses,
          (snap) => {
            if (snap.metadata.fromCache && snap.empty) return;
            setDoseLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DoseLog));
          },
          handleSnapshotError
        );

        const unsubSymptoms = onSnapshot(
          qSymptoms,
          (snap) => {
            if (snap.metadata.fromCache && snap.empty) return;
            setSymptomLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SymptomLog));
          },
          handleSnapshotError
        );

        unsubs = [unsubMembers, unsubIllnesses, unsubTreatments, unsubDoses, unsubSymptoms];

        // Consulta directa al servidor por HTTP corto: evita bloqueos de proxies 5G sobre streams largos
        const [membersSnap, illnessesSnap, treatmentsSnap, dosesSnap, symptomsSnap] =
          await Promise.all([
            getDocsFromServer(qMembers),
            getDocsFromServer(qIllnesses),
            getDocsFromServer(qTreatments),
            getDocsFromServer(qDoses),
            getDocsFromServer(qSymptoms),
          ]);

        if (cancelled) return;

        const memberList = membersSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as FamilyMember);
        setMembers(memberList);
        setSelectedMemberId((prev) =>
          prev && memberList.some((m) => m.id === prev) ? prev : memberList[0]?.id ?? null
        );
        setIllnesses(illnessesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Illness));
        setTreatments(treatmentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as TreatmentItem));
        setDoseLogs(dosesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as DoseLog));
        setSymptomLogs(symptomsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as SymptomLog));
        markOnline();
      } catch (err) {
        if (!cancelled) {
          clearTimeout(connectTimer);
          const formatted = formatSyncError(err);
          setIsOffline(true);
          setSyncStatus(formatted.status);
          setSyncError(formatted.message);
        }
      }
    }

    void subscribe();

    return () => {
      cancelled = true;
      clearTimeout(connectTimer);
      unsubs.forEach((u) => u());
    };
  }, [activeSessionFamilyId, syncTick]);

  const addOrSelectFamily = useCallback(
    async (newSession: FamilySession) => {
      const next = await upsertFamilySession(newSession);
      await applyCachedFamilyData(next.activeFamilyId);
      setFamilies(next.families);
      setActiveFamilyId(next.activeFamilyId);
    },
    [applyCachedFamilyData]
  );

  const switchFamily = useCallback(
    async (familyId: string) => {
      if (familyId === activeFamilyId) return;
      await setActiveFamilyIdInStorage(familyId);
      await applyCachedFamilyData(familyId);
      setActiveFamilyId(familyId);
    },
    [activeFamilyId, applyCachedFamilyData]
  );

  const leaveFamily = useCallback(
    async (familyId: string) => {
      const next = await removeFamilyFromStorage(familyId);
      setFamilies(next.families);
      setActiveFamilyId(next.activeFamilyId);
      await applyCachedFamilyData(next.activeFamilyId);
    },
    [applyCachedFamilyData]
  );

  const setSession = useCallback(
    (newSession: FamilySession | null) => {
      if (!newSession) {
        if (session) {
          void leaveFamily(session.family_id);
        }
        return;
      }
      void addOrSelectFamily(newSession);
    },
    [addOrSelectFamily, leaveFamily, session]
  );

  const signOutFamily = useCallback(async () => {
    if (!session) return;
    await leaveFamily(session.family_id);
  }, [leaveFamily, session]);

  const setNotificationsEnabled = useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        await initializeNotifications();
      }
      setNotificationsEnabledState(enabled);
      await saveNotificationPrefs({
        enabled,
        mutedMemberIds,
        advanceMinutes: notificationAdvanceMinutes,
      });
    },
    [mutedMemberIds, notificationAdvanceMinutes]
  );

  const toggleMemberNotifications = useCallback(
    async (memberId: string, enabled: boolean) => {
      const nextMuted = enabled
        ? mutedMemberIds.filter((id) => id !== memberId)
        : Array.from(new Set([...mutedMemberIds, memberId]));
      setMutedMemberIds(nextMuted);
      await saveNotificationPrefs({
        enabled: notificationsEnabled,
        mutedMemberIds: nextMuted,
        advanceMinutes: notificationAdvanceMinutes,
      });
    },
    [mutedMemberIds, notificationsEnabled, notificationAdvanceMinutes]
  );

  const setNotificationAdvanceMinutes = useCallback(
    async (minutes: number) => {
      const clamped = Math.max(0, Math.min(30, Math.round(minutes)));
      setNotificationAdvanceMinutesState(clamped);
      await saveNotificationPrefs({
        enabled: notificationsEnabled,
        mutedMemberIds,
        advanceMinutes: clamped,
      });
    },
    [mutedMemberIds, notificationsEnabled]
  );

  const isCaregiver = session?.role === 'caregiver';

  const value = useMemo<KiddoMedContextValue>(
    () => ({
      isReady,
      isOffline,
      syncStatus,
      families,
      session,
      isCaregiver,
      members,
      illnesses,
      treatments,
      doseLogs,
      symptomLogs,
      selectedMemberId,
      setSelectedMemberId,
      setSession,
      addOrSelectFamily,
      switchFamily,
      leaveFamily,
      signOutFamily,
      notificationsEnabled,
      mutedMemberIds,
      notificationAdvanceMinutes,
      setNotificationsEnabled,
      toggleMemberNotifications,
      setNotificationAdvanceMinutes,
      syncError,
      retrySync,
    }),
    [
      isReady,
      isOffline,
      syncStatus,
      families,
      session,
      isCaregiver,
      members,
      illnesses,
      treatments,
      doseLogs,
      symptomLogs,
      selectedMemberId,
      setSession,
      addOrSelectFamily,
      switchFamily,
      leaveFamily,
      signOutFamily,
      notificationsEnabled,
      mutedMemberIds,
      notificationAdvanceMinutes,
      setNotificationsEnabled,
      toggleMemberNotifications,
      setNotificationAdvanceMinutes,
      syncError,
      retrySync,
    ]
  );

  return <KiddoMedContext.Provider value={value}>{children}</KiddoMedContext.Provider>;
}

export function useKiddoMed(): KiddoMedContextValue {
  const ctx = useContext(KiddoMedContext);
  if (!ctx) {
    throw new Error('useKiddoMed must be used within a KiddoMedProvider');
  }
  return ctx;
}
