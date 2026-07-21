import { getScopedStorageKey } from "@/lib/authScopedStorage";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import type { NotificationSettings } from "@/types/notification";

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  notificationsEnabled: true,
  pushEnabled: true,
  inAppAlarmEnabled: true,
  soundEnabled: true,
  scheduleNotificationsEnabled: true,
  timeTaskNotificationsEnabled: true,
  periodTaskNotificationsEnabled: true,
  aiRecommendationsEnabled: true,
  repeatingNotificationsEnabled: true,
  dailySummaryEnabled: false,
  dailySummaryTime: "08:00",
  travelNotificationsEnabled: true,
  purchaseNotificationsEnabled: true,
  routineReminderEnabled: true,
  locationNotificationsEnabled: false,
  persistentAlarmEnabled: true,
  persistentAlarmPrepEnabled: true,
  persistentAlarmTravelEnabled: true,
  persistentAlarmScheduleStartEnabled: false,
  persistentAlarmIntervalMinutes: 1,
  persistentAlarmRepeatCount: 5,
  defaultPrepLeadMinutes: 30,
  travelBufferMinutes: 5,
  locationCheckWindowMinutes: 90,
  preferredTravelMode: "transit",
  updatedAt: new Date(0).toISOString(),
};

function normalizeSettings(
  value: Partial<NotificationSettings> | null
): NotificationSettings {
  return {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...(value ?? {}),
    defaultPrepLeadMinutes:
      Number(value?.defaultPrepLeadMinutes) > 0
        ? Number(value?.defaultPrepLeadMinutes)
        : DEFAULT_NOTIFICATION_SETTINGS.defaultPrepLeadMinutes,
    travelBufferMinutes:
      Number(value?.travelBufferMinutes) >= 0
        ? Number(value?.travelBufferMinutes)
        : DEFAULT_NOTIFICATION_SETTINGS.travelBufferMinutes,
    locationCheckWindowMinutes:
      Number(value?.locationCheckWindowMinutes) > 0
        ? Number(value?.locationCheckWindowMinutes)
        : DEFAULT_NOTIFICATION_SETTINGS.locationCheckWindowMinutes,
    persistentAlarmIntervalMinutes:
      Number(value?.persistentAlarmIntervalMinutes) > 0
        ? Math.min(10, Number(value?.persistentAlarmIntervalMinutes))
        : DEFAULT_NOTIFICATION_SETTINGS.persistentAlarmIntervalMinutes,
    persistentAlarmRepeatCount:
      Number(value?.persistentAlarmRepeatCount) > 0
        ? Math.min(10, Number(value?.persistentAlarmRepeatCount))
        : DEFAULT_NOTIFICATION_SETTINGS.persistentAlarmRepeatCount,
  };
}

export function getNotificationSettings(): NotificationSettings {
  if (typeof window === "undefined") {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }

  const rawValue = window.localStorage.getItem(
    getScopedStorageKey(STORAGE_KEYS.notificationSettings)
  );

  if (!rawValue) {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }

  try {
    return normalizeSettings(JSON.parse(rawValue) as Partial<NotificationSettings>);
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

export function saveNotificationSettings(
  settings: Partial<NotificationSettings>
) {
  if (typeof window === "undefined") {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }

  const nextSettings = normalizeSettings({
    ...getNotificationSettings(),
    ...settings,
    updatedAt: new Date().toISOString(),
  });

  window.localStorage.setItem(
    getScopedStorageKey(STORAGE_KEYS.notificationSettings),
    JSON.stringify(nextSettings)
  );

  return nextSettings;
}
