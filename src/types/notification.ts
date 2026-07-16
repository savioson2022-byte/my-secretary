import type { TravelMode } from "@/types/calendar";

export type NotificationEventType =
  | "schedule_start"
  | "prep_start"
  | "travel_start"
  | "purchase_recommendation"
  | "routine_reminder"
  | "place_arrival_reminder";

export type NotificationSourceType =
  | "single"
  | "routine"
  | "purchase"
  | "place";

export type NotificationSettings = {
  scheduleNotificationsEnabled: boolean;
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
};
