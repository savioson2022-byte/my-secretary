import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@/lib/notificationSettingsStorage";
import { createSupabaseUserServerClient } from "@/lib/supabase/server";
import type { NotificationSettings } from "@/types/notification";

type SettingsRecord = {
  notifications_enabled: boolean;
  push_enabled: boolean;
  in_app_alarm_enabled: boolean;
  sound_enabled: boolean;
  schedule_notifications_enabled: boolean;
  time_task_notifications_enabled: boolean;
  period_task_notifications_enabled: boolean;
  ai_recommendations_enabled: boolean;
  repeating_notifications_enabled: boolean;
  daily_summary_enabled: boolean;
  daily_summary_time: string;
  default_snooze_minutes: number;
  travel_notifications_enabled: boolean;
  purchase_notifications_enabled: boolean;
  routine_reminder_enabled: boolean;
  location_notifications_enabled: boolean;
  default_prep_lead_minutes: number;
  travel_buffer_minutes: number;
  location_check_window_minutes: number;
  preferred_travel_mode: NotificationSettings["preferredTravelMode"];
  persistent_alarm_enabled: boolean;
  persistent_alarm_prep_enabled: boolean;
  persistent_alarm_travel_enabled: boolean;
  persistent_alarm_schedule_start_enabled: boolean;
  persistent_alarm_interval_minutes: number;
  persistent_alarm_repeat_count: number;
  updated_at: string;
};

function getAccessToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return authorization.slice("bearer ".length).trim();
}

function toClientSettings(record: SettingsRecord): NotificationSettings {
  return {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    notificationsEnabled: record.notifications_enabled,
    pushEnabled: record.push_enabled,
    inAppAlarmEnabled: record.in_app_alarm_enabled,
    soundEnabled: record.sound_enabled,
    scheduleNotificationsEnabled: record.schedule_notifications_enabled,
    timeTaskNotificationsEnabled: record.time_task_notifications_enabled,
    periodTaskNotificationsEnabled: record.period_task_notifications_enabled,
    aiRecommendationsEnabled: record.ai_recommendations_enabled,
    repeatingNotificationsEnabled: record.repeating_notifications_enabled,
    dailySummaryEnabled: record.daily_summary_enabled,
    dailySummaryTime: record.daily_summary_time.slice(0, 5),
    defaultSnoozeMinutes: record.default_snooze_minutes,
    travelNotificationsEnabled: record.travel_notifications_enabled,
    purchaseNotificationsEnabled: record.purchase_notifications_enabled,
    routineReminderEnabled: record.routine_reminder_enabled,
    locationNotificationsEnabled: record.location_notifications_enabled,
    defaultPrepLeadMinutes: record.default_prep_lead_minutes,
    travelBufferMinutes: record.travel_buffer_minutes,
    locationCheckWindowMinutes: record.location_check_window_minutes,
    preferredTravelMode: record.preferred_travel_mode,
    persistentAlarmEnabled: record.persistent_alarm_enabled,
    persistentAlarmPrepEnabled: record.persistent_alarm_prep_enabled,
    persistentAlarmTravelEnabled: record.persistent_alarm_travel_enabled,
    persistentAlarmScheduleStartEnabled:
      record.persistent_alarm_schedule_start_enabled,
    persistentAlarmIntervalMinutes: record.persistent_alarm_interval_minutes,
    persistentAlarmRepeatCount: record.persistent_alarm_repeat_count,
    updatedAt: record.updated_at,
  };
}

async function getContext(request: NextRequest) {
  const accessToken = getAccessToken(request);

  if (!accessToken) {
    return {
      error: NextResponse.json(
        { ok: false, reason: "로그인이 필요합니다." },
        { status: 401 }
      ),
    };
  }

  const supabase = createSupabaseUserServerClient(accessToken);

  if (!supabase) {
    return {
      error: NextResponse.json(
        { ok: false, reason: "Supabase 설정이 필요합니다." },
        { status: 500 }
      ),
    };
  }

  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return {
      error: NextResponse.json(
        { ok: false, reason: "로그인 정보를 확인하지 못했습니다." },
        { status: 401 }
      ),
    };
  }

  return { supabase, user: data.user };
}

export async function GET(request: NextRequest) {
  const context = await getContext(request);

  if (context.error) return context.error;

  const { data, error } = await context.supabase
    .from("notification_settings")
    .select("*")
    .eq("user_id", context.user.id)
    .maybeSingle<SettingsRecord>();

  if (error) {
    return NextResponse.json(
      { ok: false, reason: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    settings: data ? toClientSettings(data) : null,
  });
}

export async function PUT(request: NextRequest) {
  const context = await getContext(request);

  if (context.error) return context.error;

  const body = (await request.json()) as Partial<NotificationSettings>;
  const now = new Date().toISOString();
  const payload = {
    user_id: context.user.id,
    notifications_enabled: body.notificationsEnabled ?? true,
    push_enabled: body.pushEnabled ?? true,
    in_app_alarm_enabled: body.inAppAlarmEnabled ?? true,
    sound_enabled: body.soundEnabled ?? true,
    schedule_notifications_enabled: body.scheduleNotificationsEnabled ?? true,
    time_task_notifications_enabled: body.timeTaskNotificationsEnabled ?? true,
    period_task_notifications_enabled: body.periodTaskNotificationsEnabled ?? true,
    ai_recommendations_enabled: body.aiRecommendationsEnabled ?? true,
    repeating_notifications_enabled: body.repeatingNotificationsEnabled ?? true,
    daily_summary_enabled: body.dailySummaryEnabled ?? false,
    daily_summary_time: body.dailySummaryTime ?? "08:00",
    default_snooze_minutes: body.defaultSnoozeMinutes ?? 10,
    travel_notifications_enabled: body.travelNotificationsEnabled ?? true,
    purchase_notifications_enabled: body.purchaseNotificationsEnabled ?? true,
    routine_reminder_enabled: body.routineReminderEnabled ?? true,
    location_notifications_enabled: body.locationNotificationsEnabled ?? false,
    default_prep_lead_minutes: body.defaultPrepLeadMinutes ?? 30,
    travel_buffer_minutes: body.travelBufferMinutes ?? 5,
    location_check_window_minutes: body.locationCheckWindowMinutes ?? 90,
    preferred_travel_mode: body.preferredTravelMode ?? "transit",
    persistent_alarm_enabled: body.persistentAlarmEnabled ?? true,
    persistent_alarm_prep_enabled: body.persistentAlarmPrepEnabled ?? true,
    persistent_alarm_travel_enabled: body.persistentAlarmTravelEnabled ?? true,
    persistent_alarm_schedule_start_enabled:
      body.persistentAlarmScheduleStartEnabled ?? true,
    persistent_alarm_interval_minutes: Math.max(
      1,
      Math.min(10, body.persistentAlarmIntervalMinutes ?? 1)
    ),
    persistent_alarm_repeat_count: Math.max(
      1,
      Math.min(10, body.persistentAlarmRepeatCount ?? 5)
    ),
    updated_at: now,
  };

  const { error } = await context.supabase
    .from("notification_settings")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    return NextResponse.json(
      { ok: false, reason: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    settings: toClientSettings({
      ...payload,
      updated_at: now,
    }),
  });
}
