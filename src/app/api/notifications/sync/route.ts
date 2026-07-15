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
  const events = (body.events ?? []).slice(0, 600);
  const now = new Date().toISOString();

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
