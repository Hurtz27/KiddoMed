import { signInAnonymously } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';
import {
  AccessRole,
  DoseLog,
  FamilyMember,
  FamilySession,
  FrequencyType,
  Illness,
  IllnessStatus,
  RegisterDoseResult,
  RelationshipType,
  SymptomLog,
  TreatmentItem,
  TreatmentItemType,
  TreatmentStatus,
} from '../types/database';
import { calculateEndDateIso } from '../utils/formatting';
import { saveFamilySession } from './cache';

let pendingAuthPromise: Promise<string> | null = null;

export async function ensureAnonymousAuth(): Promise<string> {
  if (!isFirebaseConfigured) {
    throw new Error('FIREBASE_NOT_CONFIGURED');
  }
  // Esperar a que Firebase Auth termine de restaurar la sesión persistida en AsyncStorage
  // antes de decidir si hace falta crear una sesión anónima nueva.
  await auth.authStateReady();
  if (auth.currentUser) {
    return auth.currentUser.uid;
  }
  if (!pendingAuthPromise) {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('auth/network-request-failed')), 8000);
    });
    pendingAuthPromise = Promise.race([
      signInAnonymously(auth).then((cred) => cred.user.uid),
      timeoutPromise,
    ]).finally(() => {
      pendingAuthPromise = null;
    });
  }
  return pendingAuthPromise;
}

export async function createFamilyAccount(params: {
  familyName: string;
  displayName: string;
  relationship: RelationshipType;
}): Promise<FamilySession> {
  const uid = await ensureAnonymousAuth();
  const now = new Date().toISOString();

  const familyRef = doc(collection(db, 'families'));
  const memberRef = doc(collection(db, `families/${familyRef.id}/members`));
  const roleRef = doc(db, `families/${familyRef.id}/uid_roles/${uid}`);

  const batch = writeBatch(db);

  batch.set(familyRef, {
    name: params.familyName.trim(),
    created_at: now,
  });

  const memberData: Omit<FamilyMember, 'id'> = {
    family_id: familyRef.id,
    display_name: params.displayName.trim(),
    relationship: params.relationship,
    birth_date: null,
    weight_kg: null,
    allergies: [],
    accent_color: '#0F6B64',
    has_app_access: true,
    access_role: 'caregiver',
    invite_code: null,
    linked_uid: uid,
    created_at: now,
  };

  batch.set(memberRef, memberData);
  batch.set(roleRef, { role: 'caregiver', member_id: memberRef.id });

  await batch.commit();

  const session: FamilySession = {
    family_id: familyRef.id,
    family_name: params.familyName.trim(),
    member_id: memberRef.id,
    display_name: params.displayName.trim(),
    role: 'caregiver',
  };

  await saveFamilySession(session);
  return session;
}

export async function generateMemberInviteCode(params: {
  familyId: string;
  familyName: string;
  memberId: string;
  displayName: string;
  role: AccessRole;
}): Promise<string> {
  await ensureAnonymousAuth();
  const cleanName = params.displayName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6) || 'MIEMBRO';
  const rand = Math.floor(1000 + Math.random() * 9000);
  const code = `FAM-${cleanName}-${rand}`;

  const batch = writeBatch(db);
  const memberRef = doc(db, `families/${params.familyId}/members/${params.memberId}`);
  const inviteRef = doc(db, `invites/${code}`);

  batch.update(memberRef, {
    has_app_access: true,
    access_role: params.role,
    invite_code: code,
  });

  batch.set(inviteRef, {
    family_id: params.familyId,
    family_name: params.familyName,
    member_id: params.memberId,
    display_name: params.displayName,
    role: params.role,
    created_at: new Date().toISOString(),
  });

  await batch.commit();
  return code;
}

export async function joinFamilyByInviteCode(rawCode: string): Promise<FamilySession> {
  const uid = await ensureAnonymousAuth();
  const code = rawCode.trim().toUpperCase();
  const inviteRef = doc(db, `invites/${code}`);
  const inviteSnap = await getDoc(inviteRef);

  if (!inviteSnap.exists()) {
    throw new Error('Código de invitación no encontrado. Verifica que esté bien escrito.');
  }

  const invite = inviteSnap.data() as {
    family_id: string;
    family_name: string;
    member_id: string;
    display_name: string;
    role: AccessRole;
  };

  const roleRef = doc(db, `families/${invite.family_id}/uid_roles/${uid}`);
  const memberRef = doc(db, `families/${invite.family_id}/members/${invite.member_id}`);

  // Crear rol de usuario y vincular miembro
  await setDoc(roleRef, { role: invite.role, member_id: invite.member_id });
  await updateDoc(memberRef, { linked_uid: uid });

  const session: FamilySession = {
    family_id: invite.family_id,
    family_name: invite.family_name,
    member_id: invite.member_id,
    display_name: invite.display_name,
    role: invite.role,
  };

  await saveFamilySession(session);
  return session;
}

export async function createFamilyMember(params: {
  familyId: string;
  displayName: string;
  relationship: RelationshipType;
  birthDate: string | null;
  weightKg: number | null;
  allergies: string[];
  accentColor: string;
}): Promise<string> {
  await ensureAnonymousAuth();
  const ref = doc(collection(db, `families/${params.familyId}/members`));
  const data: Omit<FamilyMember, 'id'> = {
    family_id: params.familyId,
    display_name: params.displayName.trim(),
    relationship: params.relationship,
    birth_date: params.birthDate,
    weight_kg: params.weightKg,
    allergies: params.allergies,
    accent_color: params.accentColor,
    has_app_access: false,
    access_role: 'patient',
    invite_code: null,
    linked_uid: null,
    created_at: new Date().toISOString(),
  };
  await setDoc(ref, data);
  return ref.id;
}

export async function updateFamilyMember(params: {
  familyId: string;
  memberId: string;
  displayName: string;
  relationship: RelationshipType;
  birthDate: string | null;
  weightKg: number | null;
  allergies: string[];
  accentColor: string;
}): Promise<void> {
  await ensureAnonymousAuth();
  await updateDoc(doc(db, `families/${params.familyId}/members/${params.memberId}`), {
    display_name: params.displayName.trim(),
    relationship: params.relationship,
    birth_date: params.birthDate,
    weight_kg: params.weightKg,
    allergies: params.allergies,
    accent_color: params.accentColor,
  });
}

export async function deleteFamilyMember(params: {
  familyId: string;
  memberId: string;
  inviteCode?: string | null;
}): Promise<void> {
  await ensureAnonymousAuth();
  const base = `families/${params.familyId}`;

  const [illnessesSnap, treatmentsSnap, doseLogsSnap, symptomLogsSnap] = await Promise.all([
    getDocs(query(collection(db, `${base}/illnesses`), where('member_id', '==', params.memberId))),
    getDocs(query(collection(db, `${base}/treatments`), where('member_id', '==', params.memberId))),
    getDocs(query(collection(db, `${base}/dose_logs`), where('member_id', '==', params.memberId))),
    getDocs(query(collection(db, `${base}/symptom_logs`), where('member_id', '==', params.memberId))),
  ]);

  const ops: ((batch: ReturnType<typeof writeBatch>) => void)[] = [
    (b) => b.delete(doc(db, `${base}/members/${params.memberId}`)),
    ...illnessesSnap.docs.map((d) => (b: ReturnType<typeof writeBatch>) => b.delete(d.ref)),
    ...treatmentsSnap.docs.map((d) => (b: ReturnType<typeof writeBatch>) => b.delete(d.ref)),
    ...doseLogsSnap.docs.map((d) => (b: ReturnType<typeof writeBatch>) => b.delete(d.ref)),
    ...symptomLogsSnap.docs.map((d) => (b: ReturnType<typeof writeBatch>) => b.delete(d.ref)),
  ];

  if (params.inviteCode) {
    ops.push((b) => b.delete(doc(db, `invites/${params.inviteCode}`)));
  }

  const CHUNK_SIZE = 450;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + CHUNK_SIZE)) {
      op(batch);
    }
    await batch.commit();
  }
}

export async function createIllnessRecord(params: {
  familyId: string;
  memberId: string;
  diagnosis: string;
  doctorName: string;
  diagnosedAt: string;
  notes: string | null;
  createdByName: string;
}): Promise<string> {
  await ensureAnonymousAuth();
  const ref = doc(collection(db, `families/${params.familyId}/illnesses`));
  const data: Omit<Illness, 'id'> = {
    family_id: params.familyId,
    member_id: params.memberId,
    diagnosis: params.diagnosis.trim(),
    doctor_name: params.doctorName.trim(),
    diagnosed_at: params.diagnosedAt,
    status: 'active',
    notes: params.notes?.trim() || null,
    created_by_name: params.createdByName,
    created_at: new Date().toISOString(),
  };
  await setDoc(ref, data);
  return ref.id;
}

export async function updateIllnessRecord(params: {
  familyId: string;
  illnessId: string;
  diagnosis: string;
  doctorName: string;
  diagnosedAt: string;
  notes: string | null;
}): Promise<void> {
  await ensureAnonymousAuth();
  await updateDoc(doc(db, `families/${params.familyId}/illnesses/${params.illnessId}`), {
    diagnosis: params.diagnosis.trim(),
    doctor_name: params.doctorName.trim(),
    diagnosed_at: params.diagnosedAt,
    notes: params.notes?.trim() || null,
  });
}

export async function updateIllnessStatus(params: {
  familyId: string;
  illnessId: string;
  status: IllnessStatus;
}): Promise<void> {
  await ensureAnonymousAuth();
  await updateDoc(doc(db, `families/${params.familyId}/illnesses/${params.illnessId}`), {
    status: params.status,
  });
}

export async function deleteIllnessRecord(params: {
  familyId: string;
  illnessId: string;
}): Promise<void> {
  await ensureAnonymousAuth();
  const base = `families/${params.familyId}`;

  const [treatmentsSnap, doseLogsSnap, symptomLogsSnap] = await Promise.all([
    getDocs(query(collection(db, `${base}/treatments`), where('illness_id', '==', params.illnessId))),
    getDocs(query(collection(db, `${base}/dose_logs`), where('illness_id', '==', params.illnessId))),
    getDocs(query(collection(db, `${base}/symptom_logs`), where('illness_id', '==', params.illnessId))),
  ]);

  const ops: ((batch: ReturnType<typeof writeBatch>) => void)[] = [
    (b) => b.delete(doc(db, `${base}/illnesses/${params.illnessId}`)),
    ...treatmentsSnap.docs.map((d) => (b: ReturnType<typeof writeBatch>) => b.delete(d.ref)),
    ...doseLogsSnap.docs.map((d) => (b: ReturnType<typeof writeBatch>) => b.delete(d.ref)),
    ...symptomLogsSnap.docs.map(
      (d) => (b: ReturnType<typeof writeBatch>) => b.update(d.ref, { illness_id: null })
    ),
  ];

  const CHUNK_SIZE = 450;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + CHUNK_SIZE)) {
      op(batch);
    }
    await batch.commit();
  }
}

export async function createTreatmentItemRecord(params: {
  familyId: string;
  memberId: string;
  illnessId: string;
  itemType: TreatmentItemType;
  brandName: string;
  activeIngredients: string | null;
  doseText: string;
  startDateIso: string;
  durationDays: number | null;
  frequencyType: FrequencyType;
  frequencyValue: number;
  frequencyLabel: string;
  minSafetyHours: number;
  notes: string | null;
}): Promise<string> {
  await ensureAnonymousAuth();
  const ref = doc(collection(db, `families/${params.familyId}/treatments`));
  const endDate = calculateEndDateIso(params.startDateIso, params.durationDays);

  const data: Omit<TreatmentItem, 'id'> = {
    family_id: params.familyId,
    member_id: params.memberId,
    illness_id: params.illnessId,
    item_type: params.itemType,
    brand_name: params.brandName.trim(),
    active_ingredients: params.activeIngredients?.trim() || null,
    dose_text: params.doseText.trim(),
    start_date: params.startDateIso,
    duration_days: params.durationDays,
    end_date: endDate,
    frequency_type: params.frequencyType,
    frequency_value: params.frequencyValue,
    frequency_label: params.frequencyLabel.trim(),
    min_safety_hours: params.minSafetyHours,
    notes: params.notes?.trim() || null,
    status: 'active',
    suspension_reason: null,
    next_due_at: null,
    doses_administered_count: 0,
    created_at: new Date().toISOString(),
  };

  await setDoc(ref, data);
  return ref.id;
}

export async function updateTreatmentItemRecord(params: {
  familyId: string;
  treatmentId: string;
  itemType: TreatmentItemType;
  brandName: string;
  activeIngredients: string | null;
  doseText: string;
  startDateIso: string;
  durationDays: number | null;
  frequencyType: FrequencyType;
  frequencyValue: number;
  frequencyLabel: string;
  minSafetyHours: number;
  notes: string | null;
  status?: TreatmentStatus;
}): Promise<void> {
  await ensureAnonymousAuth();
  const endDate = calculateEndDateIso(params.startDateIso, params.durationDays);
  const statusUpdate: Partial<TreatmentItem> =
    params.status === 'suspended'
      ? {
          status: 'suspended',
          suspension_reason: 'Suspendido por indicación / cambio de tratamiento',
          next_due_at: null,
        }
      : params.status === 'completed'
      ? {
          status: 'completed',
          next_due_at: null,
        }
      : params.status === 'active'
      ? {
          status: 'active',
          suspension_reason: null,
        }
      : {};

  await updateDoc(doc(db, `families/${params.familyId}/treatments/${params.treatmentId}`), {
    item_type: params.itemType,
    brand_name: params.brandName.trim(),
    active_ingredients: params.activeIngredients?.trim() || null,
    dose_text: params.doseText.trim(),
    start_date: params.startDateIso,
    duration_days: params.durationDays,
    end_date: endDate,
    frequency_type: params.frequencyType,
    frequency_value: params.frequencyValue,
    frequency_label: params.frequencyLabel.trim(),
    min_safety_hours: params.minSafetyHours,
    notes: params.notes?.trim() || null,
    ...statusUpdate,
  });
}

export async function suspendTreatmentItem(params: {
  familyId: string;
  treatmentId: string;
  reason: string;
}): Promise<void> {
  await ensureAnonymousAuth();
  await updateDoc(doc(db, `families/${params.familyId}/treatments/${params.treatmentId}`), {
    status: 'suspended',
    suspension_reason: params.reason.trim() || 'Suspendido por cuidador',
    next_due_at: null,
  });
}

const FIFTEEN_MIN_MS = 15 * 60_000;

function roundToNearest15MinutesIso(ms: number): string {
  const rounded = Math.round(ms / FIFTEEN_MIN_MS) * FIFTEEN_MIN_MS;
  return new Date(rounded).toISOString();
}

function computeNextDueIso(
  treatment: Pick<TreatmentItem, 'frequency_type' | 'frequency_value' | 'min_safety_hours'>,
  baseMs: number
): string {
  if (treatment.frequency_type === 'hours') {
    return roundToNearest15MinutesIso(baseMs + treatment.frequency_value * 3600000);
  }
  if (treatment.frequency_type === 'days') {
    return roundToNearest15MinutesIso(baseMs + treatment.frequency_value * 86400000);
  }
  // PRN: marca cuándo vuelve a ser seguro aplicarlo si persiste la fiebre/síntoma (sin redondear)
  return new Date(baseMs + treatment.min_safety_hours * 3600000).toISOString();
}

export async function registerDoseTransaction(params: {
  familyId: string;
  treatmentId: string;
  administeredAtIso: string;
  administeredByMemberName: string;
  forceOverride?: boolean;
  notes?: string | null;
}): Promise<RegisterDoseResult> {
  await ensureAnonymousAuth();
  const treatmentRef = doc(db, `families/${params.familyId}/treatments/${params.treatmentId}`);
  const logRef = doc(collection(db, `families/${params.familyId}/dose_logs`));

  return runTransaction(db, async (tx) => {
    const tSnap = await tx.get(treatmentRef);
    if (!tSnap.exists()) {
      throw new Error('No se encontró el elemento del tratamiento.');
    }

    const treatment = tSnap.data() as TreatmentItem & {
      last_administered_at?: string;
      last_administered_by?: string;
    };

    const administeredMs = new Date(params.administeredAtIso).getTime();
    const scheduledDueMs = treatment.next_due_at
      ? new Date(treatment.next_due_at).getTime()
      : null;
    const isAtOrAfterRoundedSchedule =
      scheduledDueMs !== null && !Number.isNaN(scheduledDueMs) && administeredMs >= scheduledDueMs;

    if (treatment.last_administered_at && !params.forceOverride && !isAtOrAfterRoundedSchedule) {
      const lastMs = new Date(treatment.last_administered_at).getTime();
      const diffHours = (administeredMs - lastMs) / 3600000;
      if (diffHours < treatment.min_safety_hours && diffHours >= 0) {
        return {
          status: 'TOO_EARLY',
          last_member: treatment.last_administered_by ?? 'Otro cuidador',
          minutes_ago: Math.max(0, Math.round(diffHours * 60)),
          min_safety_hours: treatment.min_safety_hours,
        };
      }
    }

    const nextDueIso = computeNextDueIso(treatment, administeredMs);

    const isPastEnd =
      treatment.end_date !== null &&
      nextDueIso !== null &&
      new Date(nextDueIso).getTime() > new Date(treatment.end_date).getTime();

    const newLog: Omit<DoseLog, 'id'> = {
      family_id: params.familyId,
      member_id: treatment.member_id,
      illness_id: treatment.illness_id,
      treatment_item_id: params.treatmentId,
      administered_at: params.administeredAtIso,
      administered_by_member_name: params.administeredByMemberName,
      dose_text: treatment.dose_text,
      was_early_override: Boolean(params.forceOverride),
      notes: params.notes?.trim() || null,
      created_at: new Date().toISOString(),
    };

    tx.set(logRef, newLog);
    tx.update(treatmentRef, {
      doses_administered_count: (treatment.doses_administered_count ?? 0) + 1,
      next_due_at: isPastEnd ? null : nextDueIso,
      status: isPastEnd ? 'completed' : 'active',
      last_administered_at: params.administeredAtIso,
      last_administered_by: params.administeredByMemberName,
    });

    return {
      status: 'OK',
      log_id: logRef.id,
      administered_at: params.administeredAtIso,
      next_due_at: isPastEnd ? null : nextDueIso,
    };
  });
}

export async function revertDoseLogTransaction(params: {
  familyId: string;
  doseLogId: string;
}): Promise<void> {
  await ensureAnonymousAuth();
  const logRef = doc(db, `families/${params.familyId}/dose_logs/${params.doseLogId}`);
  const logSnap = await getDoc(logRef);
  if (!logSnap.exists()) return;

  const logData = logSnap.data() as DoseLog;
  const treatmentRef = doc(
    db,
    `families/${params.familyId}/treatments/${logData.treatment_item_id}`
  );

  const logsSnap = await getDocs(
    query(
      collection(db, `families/${params.familyId}/dose_logs`),
      where('treatment_item_id', '==', logData.treatment_item_id)
    )
  );

  const remainingLogs = logsSnap.docs
    .filter((d) => d.id !== params.doseLogId)
    .map((d) => d.data() as DoseLog)
    .sort((a, b) => new Date(b.administered_at).getTime() - new Date(a.administered_at).getTime());

  const latestLog = remainingLogs[0] ?? null;

  await runTransaction(db, async (tx) => {
    const tSnap = await tx.get(treatmentRef);
    tx.delete(logRef);

    if (!tSnap.exists()) return;
    const treatment = tSnap.data() as TreatmentItem;

    const nextDueIso = latestLog
      ? computeNextDueIso(treatment, new Date(latestLog.administered_at).getTime())
      : null;

    tx.update(treatmentRef, {
      doses_administered_count: remainingLogs.length,
      next_due_at: nextDueIso,
      status: treatment.status === 'suspended' ? 'suspended' : 'active',
      last_administered_at: latestLog ? latestLog.administered_at : deleteField(),
      last_administered_by: latestLog ? latestLog.administered_by_member_name : deleteField(),
    });
  });
}

export async function createSymptomLogRecord(params: {
  familyId: string;
  memberId: string;
  illnessId: string | null;
  temperatureCelsius: number | null;
  symptoms: string[];
  notes: string | null;
  recordedByName: string;
}): Promise<string> {
  await ensureAnonymousAuth();
  const ref = doc(collection(db, `families/${params.familyId}/symptom_logs`));
  const data: Omit<SymptomLog, 'id'> = {
    family_id: params.familyId,
    member_id: params.memberId,
    illness_id: params.illnessId,
    recorded_at: new Date().toISOString(),
    temperature_celsius: params.temperatureCelsius,
    symptoms: params.symptoms,
    notes: params.notes?.trim() || null,
    recorded_by_name: params.recordedByName,
    created_at: new Date().toISOString(),
  };
  await setDoc(ref, data);
  return ref.id;
}

export async function updateSymptomLogRecord(params: {
  familyId: string;
  symptomLogId: string;
  temperatureCelsius: number | null;
  symptoms: string[];
  notes: string | null;
}): Promise<void> {
  await ensureAnonymousAuth();
  await updateDoc(doc(db, `families/${params.familyId}/symptom_logs/${params.symptomLogId}`), {
    temperature_celsius: params.temperatureCelsius,
    symptoms: params.symptoms,
    notes: params.notes?.trim() || null,
  });
}

export async function deleteSymptomLogRecord(params: {
  familyId: string;
  symptomLogId: string;
}): Promise<void> {
  await ensureAnonymousAuth();
  await deleteDoc(doc(db, `families/${params.familyId}/symptom_logs/${params.symptomLogId}`));
}
