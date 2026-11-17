import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { FamilyMember, TreatmentItem } from '../types/database';

const NOTIFICATION_MAP_KEY = 'kiddomed_notification_records_v2';
const NOTIFICATION_PREFS_KEY = 'kiddomed_notification_prefs_v1';

interface ScheduledRecord {
  notifId: string;
  triggerAtIso: string;
  title: string;
  body: string;
}

export interface NotificationPrefs {
  enabled: boolean;
  mutedMemberIds: string[];
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let syncQueue: Promise<void> = Promise.resolve();

function enqueueSync(task: () => Promise<void>): Promise<void> {
  const next = syncQueue.then(task, task);
  syncQueue = next.catch(() => {});
  return next;
}

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (!raw) return { enabled: true, mutedMemberIds: [] };
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : true,
      mutedMemberIds: Array.isArray(parsed.mutedMemberIds) ? parsed.mutedMemberIds : [],
    };
  } catch {
    return { enabled: true, mutedMemberIds: [] };
  }
}

export async function saveNotificationPrefs(prefs: NotificationPrefs): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
}

export async function initializeNotifications(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('medications_high', {
        name: 'Alertas de Medicamentos',
        importance: 5,
        vibrationPattern: [0, 350, 250, 350],
        lightColor: '#DC2626',
      }).catch(() => {});
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch {
    return false;
  }
}

async function getNotificationMap(): Promise<Record<string, ScheduledRecord>> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_MAP_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ScheduledRecord>) : {};
  } catch {
    return {};
  }
}

async function saveNotificationMap(map: Record<string, ScheduledRecord>): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATION_MAP_KEY, JSON.stringify(map));
}

function reminderIdentifier(prescriptionId: string): string {
  return `kiddomed_rx_${prescriptionId}`;
}

/**
 * Synchronizes local scheduled notifications with active treatments and user preferences.
 * Serialized through `syncQueue` and keyed by deterministic identifiers to prevent duplicates.
 */
export function syncPrescriptionReminders(params: {
  treatments: TreatmentItem[];
  members: FamilyMember[];
  enabled: boolean;
  mutedMemberIds: string[];
}): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();

  return enqueueSync(async () => {
    const { treatments, members, enabled, mutedMemberIds } = params;

    if (!enabled) {
      await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
      await saveNotificationMap({});
      return;
    }

    const mutedSet = new Set(mutedMemberIds);
    const memberMap = new Map(members.map((m) => [m.id, m.display_name]));
    const nowMs = Date.now();

    const desired = new Map<
      string,
      { triggerDate: Date; triggerAtIso: string; title: string; body: string }
    >();

    for (const tr of treatments) {
      if (tr.status !== 'active' || !tr.next_due_at) continue;
      if (mutedSet.has(tr.member_id)) continue;

      const triggerDate = new Date(tr.next_due_at);
      if (Number.isNaN(triggerDate.getTime()) || triggerDate.getTime() <= nowMs + 5000) {
        continue;
      }

      const patientName = memberMap.get(tr.member_id) ?? 'Miembro';
      const isPrn = tr.frequency_type === 'prn';
      const title = isPrn
        ? `Intervalo seguro cumplido: ${patientName}`
        : `Toca medicamento: ${patientName}`;
      const body = isPrn
        ? `Ya es seguro administrar ${tr.brand_name} (${tr.dose_text}) si persiste la fiebre o dolor.`
        : `Aplicar ${tr.dose_text} de ${tr.brand_name}.`;

      desired.set(tr.id, {
        triggerDate,
        triggerAtIso: tr.next_due_at,
        title,
        body,
      });
    }

    const storedMap = await getNotificationMap();
    const osScheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
    const osScheduledIds = new Set(osScheduled.map((n) => n.identifier));

    const nextMap: Record<string, ScheduledRecord> = {};
    const keepIdentifiers = new Set<string>();

    for (const [rxId, entry] of desired.entries()) {
      const existing = storedMap[rxId];
      const deterministicId = reminderIdentifier(rxId);
      const isUnchanged =
        existing &&
        existing.triggerAtIso === entry.triggerAtIso &&
        existing.title === entry.title &&
        existing.body === entry.body &&
        osScheduledIds.has(existing.notifId);

      if (isUnchanged) {
        nextMap[rxId] = existing;
        keepIdentifiers.add(existing.notifId);
        continue;
      }

      if (existing?.notifId) {
        await Notifications.cancelScheduledNotificationAsync(existing.notifId).catch(() => {});
      }
      await Notifications.cancelScheduledNotificationAsync(deterministicId).catch(() => {});

      try {
        const notifId = await Notifications.scheduleNotificationAsync({
          identifier: deterministicId,
          content: {
            title: entry.title,
            body: entry.body,
            sound: true,
            data: { prescriptionId: rxId },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: entry.triggerDate,
          },
        });

        nextMap[rxId] = {
          notifId,
          triggerAtIso: entry.triggerAtIso,
          title: entry.title,
          body: entry.body,
        };
        keepIdentifiers.add(notifId);
      } catch {
        // Evitar bloqueo si el dispositivo no soporta programación local en Expo Go
      }
    }

    // Cancelar cualquier notificación huérfana o de tratamientos ya inactivos/silenciados
    for (const scheduled of osScheduled) {
      if (!keepIdentifiers.has(scheduled.identifier)) {
        await Notifications.cancelScheduledNotificationAsync(scheduled.identifier).catch(() => {});
      }
    }

    await saveNotificationMap(nextMap);
  });
}
