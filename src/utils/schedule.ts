import { toDateKey } from '../components/ui/WeekStrip';
import { DoseLog, FamilyMember, Illness, TreatmentItem } from '../types/database';

export interface ProjectedDose {
  id: string;
  treatment: TreatmentItem;
  member: FamilyMember;
  dueAtIso: string;
  dueAtMs: number;
  status: 'pending' | 'applied';
  doseLogId?: string;
  administeredBy?: string;
  isImmediateNext: boolean;
  isOverdue: boolean;
}

export interface MemberSlotGroup {
  member: FamilyMember;
  slotKey: string;
  dateLabel: string;
  doses: ProjectedDose[];
  appliedCount: number;
  pendingCount: number;
}

export interface TimeSlotRow {
  slotKey: string;
  memberGroups: MemberSlotGroup[];
}

export interface DaySchedule {
  dateKey: string;
  label: string;
  totalDoses: number;
  appliedDoses: number;
  pendingDoses: number;
  slots: TimeSlotRow[];
}

export interface PrnTreatmentItem {
  treatment: TreatmentItem;
  member: FamilyMember;
}

export interface TreatmentScheduleResult {
  overdueDoses: ProjectedDose[];
  overdueByMember: MemberSlotGroup[];
  days: DaySchedule[];
  prnItems: PrnTreatmentItem[];
}

function toHalfHourSlotKey(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = date.getMinutes() < 30 ? '00' : '30';
  return `${hh}:${mm}`;
}

function formatDayHeading(date: Date, dayOffset: number): string {
  if (dayOffset === 0) return 'Hoy';
  if (dayOffset === 1) return 'Mañana';
  const raw = date.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * Builds the 7-day vertical schedule combining already-administered doses from today
 * and projected upcoming doses, grouped by day, 30-minute time slot, and member.
 */
export function buildTreatmentSchedule(params: {
  treatments: TreatmentItem[];
  illnesses: Illness[];
  members: FamilyMember[];
  doseLogs?: DoseLog[];
  memberFilterId: string | 'all';
  nowMs?: number;
  horizonDays?: number;
}): TreatmentScheduleResult {
  const {
    treatments,
    illnesses,
    members,
    doseLogs = [],
    memberFilterId,
    nowMs = Date.now(),
    horizonDays = 7,
  } = params;

  const memberMap = new Map(members.map((m) => [m.id, m]));
  const treatmentMap = new Map(treatments.map((t) => [t.id, t]));
  const activeIllnessIds = new Set(
    illnesses.filter((i) => i.status === 'active').map((i) => i.id)
  );

  const relevantTreatments = treatments.filter(
    (t) =>
      t.status === 'active' &&
      activeIllnessIds.has(t.illness_id) &&
      memberMap.has(t.member_id) &&
      (memberFilterId === 'all' || t.member_id === memberFilterId)
  );

  const overdueDoses: ProjectedDose[] = [];
  const timelineDoses: ProjectedDose[] = [];
  const prnItems: PrnTreatmentItem[] = [];

  const todayMidnight = new Date(nowMs);
  todayMidnight.setHours(0, 0, 0, 0);
  const todayStartMs = todayMidnight.getTime();
  const horizonEndMs = todayStartMs + horizonDays * 86_400_000;

  // Include already-applied doses from today onwards so the user sees what was applied vs pending
  for (const log of doseLogs) {
    if (memberFilterId !== 'all' && log.member_id !== memberFilterId) continue;
    const member = memberMap.get(log.member_id);
    const treatment = treatmentMap.get(log.treatment_item_id);
    if (!member || !treatment) continue;

    const logMs = new Date(log.administered_at).getTime();
    if (Number.isNaN(logMs) || logMs < todayStartMs || logMs >= horizonEndMs) continue;

    timelineDoses.push({
      id: `log-${log.id}`,
      treatment,
      member,
      dueAtIso: log.administered_at,
      dueAtMs: logMs,
      status: 'applied',
      doseLogId: log.id,
      administeredBy: log.administered_by_member_name,
      isImmediateNext: false,
      isOverdue: false,
    });
  }

  for (const tr of relevantTreatments) {
    const member = memberMap.get(tr.member_id)!;

    if (tr.frequency_type === 'prn') {
      prnItems.push({ treatment: tr, member });
      continue;
    }

    const intervalMs =
      tr.frequency_type === 'hours'
        ? Math.max(1, tr.frequency_value) * 3_600_000
        : Math.max(1, tr.frequency_value) * 86_400_000;

    const endMs = tr.end_date ? new Date(tr.end_date).getTime() : Infinity;
    const nextDueMs = tr.next_due_at ? new Date(tr.next_due_at).getTime() : null;

    let cursorMs: number;
    let firstIsImmediate = true;

    if (nextDueMs === null) {
      overdueDoses.push({
        id: `${tr.id}-overdue`,
        treatment: tr,
        member,
        dueAtIso: new Date(nowMs).toISOString(),
        dueAtMs: nowMs,
        status: 'pending',
        isImmediateNext: true,
        isOverdue: true,
      });
      // Do not project future calendar events until the first dose is applied
      continue;
    }

    if (nextDueMs <= nowMs) {
      overdueDoses.push({
        id: `${tr.id}-overdue`,
        treatment: tr,
        member,
        dueAtIso: tr.next_due_at ?? new Date(nowMs).toISOString(),
        dueAtMs: nextDueMs,
        status: 'pending',
        isImmediateNext: true,
        isOverdue: true,
      });
      cursorMs = nowMs + intervalMs;
      firstIsImmediate = false;
    } else {
      cursorMs = nextDueMs;
    }

    let step = 0;
    while (cursorMs < horizonEndMs && cursorMs <= endMs && step < 100) {
      const dueIso = new Date(cursorMs).toISOString();
      timelineDoses.push({
        id: `${tr.id}-${cursorMs}`,
        treatment: tr,
        member,
        dueAtIso: dueIso,
        dueAtMs: cursorMs,
        status: 'pending',
        isImmediateNext: firstIsImmediate && step === 0,
        isOverdue: false,
      });
      cursorMs += intervalMs;
      step += 1;
    }
  }

  overdueDoses.sort((a, b) => a.dueAtMs - b.dueAtMs);

  const overdueMemberMap = new Map<string, MemberSlotGroup>();
  for (const dose of overdueDoses) {
    const existing = overdueMemberMap.get(dose.member.id);
    if (existing) {
      existing.doses.push(dose);
      existing.pendingCount += 1;
    } else {
      overdueMemberMap.set(dose.member.id, {
        member: dose.member,
        slotKey: 'Ahora',
        dateLabel: 'Pendiente ahora',
        doses: [dose],
        appliedCount: 0,
        pendingCount: 1,
      });
    }
  }

  // Group timeline doses by dateKey -> slotKey -> memberId
  const dayBuckets = new Map<string, Map<string, Map<string, ProjectedDose[]>>>();
  for (const dose of timelineDoses) {
    const d = new Date(dose.dueAtMs);
    const dateKey = toDateKey(d);
    const slotKey = toHalfHourSlotKey(d);

    let slotMap = dayBuckets.get(dateKey);
    if (!slotMap) {
      slotMap = new Map();
      dayBuckets.set(dateKey, slotMap);
    }
    let memberBuckets = slotMap.get(slotKey);
    if (!memberBuckets) {
      memberBuckets = new Map();
      slotMap.set(slotKey, memberBuckets);
    }
    const list = memberBuckets.get(dose.member.id) ?? [];
    list.push(dose);
    memberBuckets.set(dose.member.id, list);
  }

  const days: DaySchedule[] = [];
  for (let offset = 0; offset < horizonDays; offset++) {
    const dayDate = new Date(
      todayMidnight.getFullYear(),
      todayMidnight.getMonth(),
      todayMidnight.getDate() + offset
    );
    const dateKey = toDateKey(dayDate);
    const slotMap = dayBuckets.get(dateKey);

    if (!slotMap && offset > 0) continue;

    const label = formatDayHeading(dayDate, offset);
    const slots: TimeSlotRow[] = [];
    let totalDoses = 0;
    let appliedDoses = 0;
    let pendingDoses = 0;

    if (slotMap) {
      const sortedSlotKeys = Array.from(slotMap.keys()).sort();
      for (const slotKey of sortedSlotKeys) {
        const memberBuckets = slotMap.get(slotKey)!;
        const memberGroups: MemberSlotGroup[] = [];
        for (const doses of memberBuckets.values()) {
          doses.sort((a, b) => a.dueAtMs - b.dueAtMs);
          const groupApplied = doses.filter((d) => d.status === 'applied').length;
          const groupPending = doses.length - groupApplied;
          totalDoses += doses.length;
          appliedDoses += groupApplied;
          pendingDoses += groupPending;
          memberGroups.push({
            member: doses[0].member,
            slotKey,
            dateLabel: `${label} · ${slotKey}`,
            doses,
            appliedCount: groupApplied,
            pendingCount: groupPending,
          });
        }
        slots.push({ slotKey, memberGroups });
      }
    }

    days.push({
      dateKey,
      label,
      totalDoses,
      appliedDoses,
      pendingDoses,
      slots,
    });
  }

  prnItems.sort((a, b) => {
    const aMs = a.treatment.next_due_at ? new Date(a.treatment.next_due_at).getTime() : 0;
    const bMs = b.treatment.next_due_at ? new Date(b.treatment.next_due_at).getTime() : 0;
    return aMs - bMs;
  });

  return {
    overdueDoses,
    overdueByMember: Array.from(overdueMemberMap.values()),
    days,
    prnItems,
  };
}
