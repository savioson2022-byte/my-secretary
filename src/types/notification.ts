import type { TravelMode } from "@/types/calendar";

export type NotificationEventType =
  | "schedule_start"
  | "prep_start"
  | "travel_start"
  | "purchase_recommendation"
  | "routine_reminder"
  | "place_arrival_reminder"
  | "time_task"
  | "period_task"
  | "ai_recommendation"
  | "daily_summary"
  | "sleep"
  | "wake"
  | "custom_alarm";

export type NotificationSourceType =
  | "single"
  | "routine"
  | "purchase"
  | "place"
  | "assistant_item"
  | "time_task_plan"
  | "ai"
  | "custom";

export type NotificationType =
  | "time_based"
  | "time_task"
  | "period_task"
  | "ai_recommendation"
  | "recurring"
  | "daily_summary"
  | "sleep"
  | "wake"
  | "custom_alarm";

export type NotificationScheduleType =
  | "once"
  | "daily"
  | "weekly"
  | "monthly"
  | "interval"
  | "derived";

export type NotificationChannel =
  | "in_app"
  | "web_push"
  | "native_push"
  | "kakao"
  | "apple_watch";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export type NotificationDeliveryStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "failed"
  | "skipped";

export type NotificationRule = {
  id: string;
  name: string;
  notificationType: NotificationType;
  sourceType: NotificationSourceType;
  sourceId: string | null;
  enabled: boolean;
  scheduleType: NotificationScheduleType;
  timezone: string;
  scheduledTime: string | null;
  startsAt: string | null;
  endsAt: string | null;
  daysOfWeek: number[];
  dayOfMonth: number | null;
  intervalMinutes: number | null;
  leadMinutes: number[];
  deliveryChannels: NotificationChannel[];
  soundEnabled: boolean;
  soundKey: string;
  requireInteraction: boolean;
  snoozeMinutes: number[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type NotificationSettings = {
  notificationsEnabled: boolean;
  pushEnabled: boolean;
  inAppAlarmEnabled: boolean;
  soundEnabled: boolean;
  scheduleNotificationsEnabled: boolean;
  timeTaskNotificationsEnabled: boolean;
  periodTaskNotificationsEnabled: boolean;
  aiRecommendationsEnabled: boolean;
  repeatingNotificationsEnabled: boolean;
  dailySummaryEnabled: boolean;
  dailySummaryTime: string;
  defaultSnoozeMinutes: number;
  travelNotificationsEnabled: boolean;
  purchaseNotificationsEnabled: boolean;
  routineReminderEnabled: boolean;
  locationNotificationsEnabled: boolean;
  persistentAlarmEnabled: boolean;
  persistentAlarmPrepEnabled: boolean;
  persistentAlarmTravelEnabled: boolean;
  persistentAlarmScheduleStartEnabled: boolean;
  persistentAlarmIntervalMinutes: number;
  persistentAlarmRepeatCount: number;
  defaultPrepLeadMinutes: number;
  travelBufferMinutes: number;
  locationCheckWindowMinutes: number;
  preferredTravelMode: TravelMode;
  updatedAt: string;
};

export type NotificationEvent = {
  id: string;
  eventType: NotificationEventType;
  sourceType: NotificationSourceType;
  sourceId: string;
  occurrenceDate: string;
  scheduledAt: string;
  title: string;
  body: string;
  url: string;
  placeName: string;
  placeAddress?: string;
  latitude?: number | null;
  longitude?: number | null;
  requiresLocationCheck: boolean;
  ruleId?: string | null;
  notificationType?: NotificationType;
  priority?: NotificationPriority;
  deliveryChannels?: NotificationChannel[];
  soundEnabled?: boolean;
  soundKey?: string;
  requireInteraction?: boolean;
  expiresAt?: string | null;
  payload?: Record<string, unknown>;
};

export type NotificationDeliveryAttempt = {
  id: string;
  eventId: string;
  channel: NotificationChannel;
  destinationId: string;
  status: NotificationDeliveryStatus;
  providerMessageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  attemptedAt: string;
  deliveredAt: string | null;
};
