import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { db, isFirebaseConfigured } from '../lib/firebase';
import {
  clearFamilySession,
  loadFamilySession,
  loadReadCache,
  saveReadCache,
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
  signOutFamily: () => Promise<void>;
  syncError: string | null;
}

const KiddoMedContext = createContext<KiddoMedContextValue | null>(null);

export function KiddoMedProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [session, setSessionState] = useState<FamilySession | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [illnesses, setIllnesses] = useState<Illness[]>([]);
  const [treatments, setTreatments] = useState<TreatmentItem[]>([]);
  const [doseLogs, setDoseLogs] = useState<DoseLog[]>([]);
  const [symptomLogs, setSymptomLogs] = useState<SymptomLog[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function bootstrap() {
      await initializeNotifications();
      const savedSession = await loadFamilySession();
      const cached = await loadReadCache();

      if (!mounted) return;

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

      if (savedSession) {
        setSessionState(savedSession);
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

  // Guardar caché de lectura ante cambios
  useEffect(() => {
    if (!session) return;
    void saveReadCache({
      members,
      illnesses,
      treatments,
      doseLogs,
      symptomLogs,
      updatedAt: new Date().toISOString(),
    });
  }, [session, members, illnesses, treatments, doseLogs, symptomLogs]);

  // Listeners en tiempo real de Firestore
  useEffect(() => {
    if (!session || !isFirebaseConfigured) return;

    let unsubs: (() => void)[] = [];
    let cancelled = false;

    async function subscribe() {
      try {
        await ensureAnonymousAuth();
        if (cancelled || !session) return;

        const base = `families/${session.family_id}`;

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
  }, [session]);

  const setSession = useCallback((newSession: FamilySession | null) => {
    setSessionState(newSession);
  }, []);

  const signOutFamily = useCallback(async () => {
    await clearFamilySession();
    setSessionState(null);
    setMembers([]);
    setIllnesses([]);
    setTreatments([]);
    setDoseLogs([]);
    setSymptomLogs([]);
    setSelectedMemberId(null);
  }, []);

  const isCaregiver = session?.role === 'caregiver';

  const value = useMemo<KiddoMedContextValue>(
    () => ({
      isReady,
      isOffline,
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
      signOutFamily,
      syncError,
    }),
    [
      isReady,
      isOffline,
      session,
      isCaregiver,
      members,
      illnesses,
      treatments,
      doseLogs,
      symptomLogs,
      selectedMemberId,
      setSession,
      signOutFamily,
      syncError,
    ]
  );

  return <KiddoMedContext.Provider value={value}>{children}</KiddoMedContext.Provider>;
}

export function useKiddoMed() {
  const ctx = useContext(KiddoMedContext);
  if (!ctx) throw new Error('useKiddoMed debe usarse dentro de KiddoMedProvider');
  return ctx;
}
