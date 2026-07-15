import { NextRequest, NextResponse } from "next/server";
import { createSupabaseUserServerClient } from "@/lib/supabase/server";
import type { NotificationSettings } from "@/types/notification";

type SettingsRecord = {
  schedule_notifications_enabled: boolean;
  travel_notifications_enabled: boolean;
  purchase_notifications_enabled: boolean;
  routine_reminder_enabled: boolean;
  location_notifications_enabled: boolean;
  default_prep_lead_minutes: number;
  travel_buffer_minutes: number;
  location_check_window_minutes: number;
  preferred_travel_mode: NotificationSettings["preferredTravelMode"];
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
    scheduleNotificationsEnabled: record.schedule_notifications_enabled,
    travelNotificationsEnabled: record.travel_notifications_enabled,
    purchaseNotificationsEnabled: record.purchase_notifications_enabled,
    routineReminderEnabled: record.routine_reminder_enabled,
    locationNotificationsEnabled: record.location_notifications_enabled,
    defaultPrepLeadMinutes: record.default_prep_lead_minutes,
    travelBufferMinutes: record.travel_buffer_minutes,
    locationCheckWindowMinutes: record.location_check_window_minutes,
    preferredTravelMode: record.preferred_travel_mode,
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
    schedule_notifications_enabled: body.scheduleNotificationsEnabled ?? true,
    travel_notifications_enabled: body.travelNotificationsEnabled ?? true,
    purchase_notifications_enabled: body.purchaseNotificationsEnabled ?? true,
    routine_reminder_enabled: body.routineReminderEnabled ?? true,
    location_notifications_enabled: body.locationNotificationsEnabled ?? false,
    default_prep_lead_minutes: body.defaultPrepLeadMinutes ?? 30,
    travel_buffer_minutes: body.travelBufferMinutes ?? 5,
    location_check_window_minutes: body.locationCheckWindowMinutes ?? 90,
    preferred_travel_mode: body.preferredTravelMode ?? "transit",
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
