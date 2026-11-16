import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const NOTIFICATION_MAP_KEY = 'kiddomed_notification_ids_v1';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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

async function getNotificationMap(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_MAP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveNotificationMap(map: Record<string, string>): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATION_MAP_KEY, JSON.stringify(map));
}

export async function cancelPrescriptionReminder(prescriptionId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const map = await getNotificationMap();
  const notifId = map[prescriptionId];
  if (notifId) {
    await Notifications.cancelScheduledNotificationAsync(notifId).catch(() => {});
    delete map[prescriptionId];
    await saveNotificationMap(map);
  }
}

export async function schedulePrescriptionReminder(params: {
  prescriptionId: string;
  patientName: string;
  medicationName: string;
  doseText: string;
  triggerAtIso: string;
  isPrn?: boolean;
}): Promise<void> {
  if (Platform.OS === 'web') return;

  await cancelPrescriptionReminder(params.prescriptionId);

  const triggerDate = new Date(params.triggerAtIso);
  const nowMs = Date.now();
  if (triggerDate.getTime() <= nowMs + 5000) {
    return;
  }

  const title = params.isPrn
    ? `Intervalo seguro cumplido: ${params.patientName}`
    : `Toca medicamento: ${params.patientName}`;

  const body = params.isPrn
    ? `Ya es seguro administrar ${params.medicationName} (${params.doseText}) si persiste la fiebre o dolor.`
    : `Aplicar ${params.doseText} de ${params.medicationName}.`;

  try {
    const notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        data: { prescriptionId: params.prescriptionId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });

    const map = await getNotificationMap();
    map[params.prescriptionId] = notifId;
    await saveNotificationMap(map);
  } catch {
    // Evitar bloqueo si el dispositivo no soporta programación local en Expo Go
  }
}
