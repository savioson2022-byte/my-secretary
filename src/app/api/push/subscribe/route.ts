import { NextRequest, NextResponse } from "next/server";
import { createSupabaseUserServerClient } from "@/lib/supabase/server";

type SubscribeRequestBody = {
  subscription?: {
    endpoint?: string;
    keys?: {
      p256dh?: string;
      auth?: string;
    };
  };
  deviceName?: string;
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

  const body = (await request.json()) as SubscribeRequestBody;
  const endpoint = body.subscription?.endpoint;
  const p256dh = body.subscription?.keys?.p256dh;
  const auth = body.subscription?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { ok: false, reason: "푸시 구독 정보가 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userData.user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: request.headers.get("user-agent") ?? "",
      device_name: body.deviceName?.trim() || "나의 기기",
      enabled: true,
      last_seen_at: now,
      updated_at: now,
    },
    {
      onConflict: "endpoint",
    }
  );

  if (error) {
    return NextResponse.json(
      { ok: false, reason: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
