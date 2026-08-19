import type { NotificationSettings } from "@/types/notification";

/**
 * 알림 프리셋.
 *
 * 토글이 20개면 사용자는 기본값을 믿지 못해 설정 순례를 하고, 한 번 잘못 켜서
 * 아프면 앱을 지우는 대신 알림을 전부 꺼버린다. 그러면 앱이 먼저 말을 걸 수
 * 없어지고 잊힌다. 그래서 안전한 중간 지점을 이름 붙여 세 개만 남긴다.
 *
 * 개별 토글은 없애지 않고 "고급 설정" 뒤에 그대로 둔다.
 */

export type NotificationPresetId = "quiet" | "normal" | "insistent";

/** 프리셋이 결정하는 값들. 나머지 설정은 사용자가 정한 대로 둔다. */
export type NotificationPresetValues = Pick<
  NotificationSettings,
  | "notificationsEnabled"
  | "pushEnabled"
  | "inAppAlarmEnabled"
  | "soundEnabled"
  | "scheduleNotificationsEnabled"
  | "timeTaskNotificationsEnabled"
  | "travelNotificationsEnabled"
  | "routineReminderEnabled"
  | "aiRecommendationsEnabled"
  | "repeatingNotificationsEnabled"
  | "dailySummaryEnabled"
  | "persistentAlarmEnabled"
  | "persistentAlarmPrepEnabled"
  | "persistentAlarmTravelEnabled"
  | "persistentAlarmScheduleStartEnabled"
>;

export type NotificationPreset = {
  id: NotificationPresetId;
  label: string;
  description: string;
  values: NotificationPresetValues;
};

export const NOTIFICATION_PRESETS: NotificationPreset[] = [
  {
    id: "quiet",
    label: "조용히",
    description: "소리 없이 알림만. 화면을 볼 때 확인합니다.",
    values: {
      notificationsEnabled: true,
      pushEnabled: true,
      inAppAlarmEnabled: true,
      soundEnabled: false,
      scheduleNotificationsEnabled: true,
      timeTaskNotificationsEnabled: false,
      travelNotificationsEnabled: true,
      routineReminderEnabled: false,
      aiRecommendationsEnabled: false,
      repeatingNotificationsEnabled: false,
      dailySummaryEnabled: false,
      persistentAlarmEnabled: false,
      persistentAlarmPrepEnabled: false,
      persistentAlarmTravelEnabled: false,
      persistentAlarmScheduleStartEnabled: false,
    },
  },
  {
    id: "normal",
    label: "보통",
    description: "소리로 알려주되 반복해서 울리지는 않습니다.",
    values: {
      notificationsEnabled: true,
      pushEnabled: true,
      inAppAlarmEnabled: true,
      soundEnabled: true,
      scheduleNotificationsEnabled: true,
      timeTaskNotificationsEnabled: true,
      travelNotificationsEnabled: true,
      routineReminderEnabled: true,
      aiRecommendationsEnabled: true,
      repeatingNotificationsEnabled: false,
      dailySummaryEnabled: true,
      persistentAlarmEnabled: false,
      persistentAlarmPrepEnabled: false,
      persistentAlarmTravelEnabled: false,
      persistentAlarmScheduleStartEnabled: false,
    },
  },
  {
    id: "insistent",
    label: "놓치면 안 됨",
    description: "준비와 출발 시각에 확인할 때까지 반복해서 울립니다.",
    values: {
      notificationsEnabled: true,
      pushEnabled: true,
      inAppAlarmEnabled: true,
      soundEnabled: true,
      scheduleNotificationsEnabled: true,
      timeTaskNotificationsEnabled: true,
      travelNotificationsEnabled: true,
      routineReminderEnabled: true,
      aiRecommendationsEnabled: true,
      repeatingNotificationsEnabled: true,
      dailySummaryEnabled: true,
      persistentAlarmEnabled: true,
      persistentAlarmPrepEnabled: true,
      persistentAlarmTravelEnabled: true,
      persistentAlarmScheduleStartEnabled: true,
    },
  },
];

export function findMatchingPreset(
  settings: NotificationSettings
): NotificationPresetId | null {
  const matched = NOTIFICATION_PRESETS.find((preset) => {
    return (
      Object.keys(preset.values) as (keyof NotificationPresetValues)[]
    ).every((key) => settings[key] === preset.values[key]);
  });

  return matched?.id ?? null;
}
