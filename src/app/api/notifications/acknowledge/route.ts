import { NextRequest, NextResponse } from "next/server";
import { createSupabaseUserServerClient } from "@/lib/supabase/server";

function getAccessToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
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

  const body = (await request.json()) as {
    groupId?: string;
    action?: string;
    snoozeMinutes?: number;
  };
  const groupId = body.groupId?.trim();
  if (!groupId) {
    return NextResponse.json(
      { ok: false, reason: "알람 그룹 정보가 없습니다." },
      { status: 400 }
    );
  }

  const now = new Date();
  const snoozeMinutes = Math.max(
    1,
    Math.min(1440, Number(body.snoozeMinutes) || 10)
  );
  const snoozedUntil =
    body.action === "snoozed"
      ? new Date(now.getTime() + snoozeMinutes * 60 * 1000).toISOString()
      : null;
  const action =
    body.action === "snoozed" || body.action === "muted_today"
      ? body.action
      : "confirmed";
  const { error: acknowledgementError } = await supabase
    .from("persistent_alarm_acknowledgements")
    .upsert(
      {
        user_id: userData.user.id,
        alarm_group_id: groupId,
        action,
        snoozed_until: snoozedUntil,
        acknowledged_at: now.toISOString(),
      },
      { onConflict: "user_id,alarm_group_id" }
    );

  if (acknowledgementError) {
    return NextResponse.json(
      { ok: false, reason: acknowledgementError.message },
      { status: 500 }
    );
  }

  const { data: pendingEvents, error: selectError } = await supabase
    .from("notification_events")
    .select("id")
    .eq("user_id", userData.user.id)
    .eq("active", true)
    .contains("payload", { persistentAlarmGroupId: groupId })
    .gte("scheduled_at", now.toISOString())
    .order("scheduled_at", { ascending: true });

  if (selectError) {
    return NextResponse.json(
      { ok: false, reason: selectError.message },
      { status: 500 }
    );
  }

  const { error } = await supabase
    .from("notification_events")
    .update({
      active: false,
      updated_at: now.toISOString(),
    })
    .eq("user_id", userData.user.id)
    .contains("payload", { persistentAlarmGroupId: groupId })
    .gte("scheduled_at", new Date().toISOString());

  if (error) {
    return NextResponse.json(
      { ok: false, reason: error.message },
      { status: 500 }
    );
  }

  if (body.action === "snoozed" && pendingEvents?.[0]) {
    const { error: snoozeError } = await supabase
      .from("notification_events")
      .update({
        active: true,
        scheduled_at: snoozedUntil,
        updated_at: now.toISOString(),
      })
      .eq("user_id", userData.user.id)
      .eq("id", pendingEvents[0].id);

    if (snoozeError) {
      return NextResponse.json(
        { ok: false, reason: snoozeError.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
