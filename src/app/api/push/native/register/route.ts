import { NextResponse } from "next/server";
import { getAuthedSupabaseForRequest } from "@/lib/apiAuth";

type NativeRegisterBody = {
  token?: string;
  platform?: string;
  deviceName?: string;
  appVersion?: string;
};

export async function POST(request: Request) {
  const context = await getAuthedSupabaseForRequest(request);

  if (!context?.supabase) {
    return NextResponse.json(
      { ok: false, reason: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  const body = (await request.json()) as NativeRegisterBody;
  const token = body.token?.trim();

  if (!token) {
    return NextResponse.json(
      { ok: false, reason: "아이폰 푸시 토큰을 확인하지 못했습니다." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const { error } = await context.supabase.from("native_push_tokens").upsert(
    {
      user_id: context.auth.user.id,
      platform: body.platform?.trim() || "ios",
      token,
      device_name: body.deviceName?.trim() || "iPhone",
      app_version: body.appVersion?.trim() || "",
      enabled: true,
      last_seen_at: now,
      updated_at: now,
    },
    { onConflict: "token" }
  );

  if (error) {
    return NextResponse.json(
      { ok: false, reason: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
