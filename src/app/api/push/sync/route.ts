import { NextRequest, NextResponse } from "next/server";
import { createSupabaseUserServerClient } from "@/lib/supabase/server";

type ScheduleEntryInput = {
  sourceType: "single" | "routine";
  sourceId: string;
  occurrenceDate: string;
  startTime: string;
  title: string;
  placeName?: string;
  reminderOffsets?: number[];
  timezone?: string;
};

type SyncRequestBody = {
  entries?: ScheduleEntryInput[];
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
  const entries = (body.entries ?? []).slice(0, 300);
  const now = new Date().toISOString();

  if (entries.length === 0) {
    return NextResponse.json({ ok: true, count: 0 });
  }

  const { error } = await supabase.from("notification_schedule_entries").upsert(
    entries.map((entry) => ({
      user_id: userData.user.id,
      source_type: entry.sourceType,
      source_id: entry.sourceId,
      occurrence_date: entry.occurrenceDate,
      start_time: entry.startTime,
      title: entry.title,
      place_name: entry.placeName ?? "",
      reminder_offsets: entry.reminderOffsets ?? [10, 0],
      timezone: entry.timezone ?? "Asia/Seoul",
      active: true,
      synced_at: now,
      updated_at: now,
    })),
    {
      onConflict: "user_id,source_type,source_id,occurrence_date",
    }
  );

  if (error) {
    return NextResponse.json(
      { ok: false, reason: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, count: entries.length });
}
