import { NextRequest, NextResponse } from "next/server";
import { createSupabaseUserServerClient } from "@/lib/supabase/server";
import type { NotificationEvent } from "@/types/notification";

type SyncRequestBody = {
  events?: NotificationEvent[];
};

function getAccessToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return authorization.slice("bearer ".length).trim();
}

export async function POST(request: NextRequest) {
  const accessToken = getAccessToken(request);

  if (!accessToken) {
    return NextResponse.json(
      { ok: false, reason: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  const supabase = createSupabaseUserServerClient(accessToken);

  if (!supabase) {
    return NextResponse.json(
      { ok: false, reason: "Supabase 설정이 필요합니다." },
      { status: 500 }
    );
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json(
      { ok: false, reason: "로그인 정보를 확인하지 못했습니다." },
      { status: 401 }
    );
  }

  const body = (await request.json()) as SyncRequestBody;
  const requestedEvents = (body.events ?? []).slice(0, 600);
  const now = new Date().toISOString();
  const { data: acknowledgements, error: acknowledgementError } =
    await supabase
      .from("persistent_alarm_acknowledgements")
      .select("alarm_group_id,action,snoozed_until")
      .eq("user_id", userData.user.id);

  if (acknowledgementError) {
    return NextResponse.json(
      { ok: false, reason: acknowledgementError.message },
      { status: 500 }
    );
  }

  const blockedGroupIds = new Set(
    (acknowledgements ?? [])
      .filter(
        (item) =>
          item.action !== "snoozed" ||
          (item.snoozed_until && item.snoozed_until > now)
      )
      .map((item) => item.alarm_group_id)
  );
  const events = requestedEvents.filter((event) => {
    const groupId = event.payload?.persistentAlarmGroupId;
    return typeof groupId !== "string" || !blockedGroupIds.has(groupId);
  });

  const { error: deactivateError } = await supabase
    .from("notification_events")
    .update({ active: false, updated_at: now })
    .eq("user_id", userData.user.id)
    .gte("scheduled_at", now);

  if (deactivateError) {
    return NextResponse.json(
      { ok: false, reason: deactivateError.message },
      { status: 500 }
    );
  }

  if (events.length === 0) {
    return NextResponse.json({ ok: true, count: 0 });
  }

  const { error } = await supabase.from("notification_events").upsert(
    events.map((event) => ({
      user_id: userData.user.id,
      client_event_id: event.id,
      event_type: event.eventType,
      source_type: event.sourceType,
      source_id: event.sourceId,
      occurrence_date: event.occurrenceDate,
      scheduled_at: event.scheduledAt,
      title: event.title,
      body: event.body,
      url: event.url,
      place_name: event.placeName,
      place_address: event.placeAddress ?? "",
      latitude: event.latitude ?? null,
      longitude: event.longitude ?? null,
      requires_location_check: event.requiresLocationCheck,
      rule_id: event.ruleId ?? null,
      notification_type: event.notificationType ?? "time_based",
      priority: event.priority ?? "normal",
      delivery_channels: event.deliveryChannels ?? ["in_app", "web_push"],
      sound_enabled: event.soundEnabled ?? true,
      sound_key: event.soundKey ?? "default",
      require_interaction: event.requireInteraction ?? false,
      expires_at: event.expiresAt ?? null,
      payload: event.payload ?? {},
      active: true,
      synced_at: now,
      updated_at: now,
    })),
    { onConflict: "user_id,client_event_id" }
  );

  if (error) {
    return NextResponse.json(
      { ok: false, reason: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, count: events.length });
}
