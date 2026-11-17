import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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
  cancelPrescriptionReminder,
  initializeNotifications,
  schedulePrescriptionReminder,
} from '../services/notifications';
import {
  DoseLog,
  FamilyMember,
  FamilySession,
  Illness,
  SymptomLog,
  TreatmentItem,
} from '../types/database';

interface KiddoMedContextValue {
  isReady: boolean;
  isOffline: boolean;
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
  syncError: string | null;
}

const KiddoMedContext = createContext<KiddoMedContextValue | null>(null);

export function KiddoMedProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [families, setFamilies] = useState<FamilySession[]>([]);
  const [activeFamilyId, setActiveFamilyId] = useState<string | null>(null);

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [illnesses, setIllnesses] = useState<Illness[]>([]);
  const [treatments, setTreatments] = useState<TreatmentItem[]>([]);
  const [doseLogs, setDoseLogs] = useState<DoseLog[]>([]);
  const [symptomLogs, setSymptomLogs] = useState<SymptomLog[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

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
      await initializeNotifications();
      const stored = await loadFamiliesState();
      const cached = stored.activeFamilyId
        ? await loadReadCache(stored.activeFamilyId)
        : null;

      if (!mounted) return;

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

  // Reprogramar recordatorios locales cuando cambien tratamientos o miembros
  useEffect(() => {
    if (!isReady) return;
    const memberMap = new Map(members.map((m) => [m.id, m.display_name]));
    for (const tr of treatments) {
      if (tr.status !== 'active' || !tr.next_due_at) {
        void cancelPrescriptionReminder(tr.id);
        continue;
      }
      void schedulePrescriptionReminder({
        prescriptionId: tr.id,
        patientName: memberMap.get(tr.member_id) ?? 'Miembro',
        medicationName: tr.brand_name,
        doseText: tr.dose_text,
        triggerAtIso: tr.next_due_at,
        isPrn: tr.frequency_type === 'prn',
      });
    }
  }, [isReady, members, treatments]);

  // Guardar caché de lectura ante cambios de la familia activa
  useEffect(() => {
    if (!session) return;
    void saveReadCache(session.family_id, {
      members,
      illnesses,
      treatments,
      doseLogs,
      symptomLogs,
      updatedAt: new Date().toISOString(),
    });
  }, [session, members, illnesses, treatments, doseLogs, symptomLogs]);

  // Listeners en tiempo real de Firestore para la familia activa
  const activeSessionFamilyId = session?.family_id ?? null;

  useEffect(() => {
    if (!activeSessionFamilyId || !isFirebaseConfigured) return;

    const currentFamilyId = activeSessionFamilyId;
    let unsubs: (() => void)[] = [];
    let cancelled = false;

    async function subscribe() {
      try {
        await ensureAnonymousAuth();
        if (cancelled) return;

        const base = `families/${currentFamilyId}`;

        const unsubMembers = onSnapshot(
          query(collection(db, `${base}/members`), orderBy('created_at', 'asc')),
          (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FamilyMember);
            setMembers(list);
            setSelectedMemberId((prev) =>
              prev && list.some((m) => m.id === prev) ? prev : list[0]?.id ?? null
            );
            setIsOffline(false);
            setSyncError(null);
          },
          (err) => {
            setIsOffline(true);
            setSyncError(err.message);
          }
        );

        const unsubIllnesses = onSnapshot(
          query(collection(db, `${base}/illnesses`), orderBy('diagnosed_at', 'desc')),
          (snap) => {
            setIllnesses(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Illness));
          }
        );

        const unsubTreatments = onSnapshot(
          query(collection(db, `${base}/treatments`), orderBy('created_at', 'desc')),
          (snap) => {
            setTreatments(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TreatmentItem));
          }
        );

        const unsubDoses = onSnapshot(
          query(collection(db, `${base}/dose_logs`), orderBy('administered_at', 'desc')),
          (snap) => {
            setDoseLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DoseLog));
          }
        );

        const unsubSymptoms = onSnapshot(
          query(collection(db, `${base}/symptom_logs`), orderBy('recorded_at', 'desc')),
          (snap) => {
            setSymptomLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SymptomLog));
          }
        );

        unsubs = [unsubMembers, unsubIllnesses, unsubTreatments, unsubDoses, unsubSymptoms];
      } catch (err) {
        if (!cancelled) {
          setIsOffline(true);
          setSyncError(err instanceof Error ? err.message : 'Error de conexión con Firebase.');
        }
      }
    }

    void subscribe();

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [activeSessionFamilyId]);

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

  const isCaregiver = session?.role === 'caregiver';

  const value = useMemo<KiddoMedContextValue>(
    () => ({
      isReady,
      isOffline,
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
      syncError,
    }),
    [
      isReady,
      isOffline,
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
      syncError,
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
