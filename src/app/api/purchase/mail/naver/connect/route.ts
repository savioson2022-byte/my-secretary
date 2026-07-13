import { NextResponse } from "next/server";
import { getAuthedSupabaseForRequest } from "@/lib/apiAuth";

export async function POST(request: Request) {
  const context = await getAuthedSupabaseForRequest(request);
  const body = await request.json();
  const email = String(body.email ?? "").trim();
  const appPassword = String(body.appPassword ?? "").trim();

  if (!context?.supabase) {
    return NextResponse.json(
      {
        error: "로그인이 필요합니다.",
      },
      {
        status: 401,
      }
    );
  }

  if (!email.endsWith("@naver.com") || !appPassword) {
    return NextResponse.json(
      {
        error: "네이버 메일 주소와 앱 비밀번호를 입력해야 합니다.",
      },
      {
        status: 400,
      }
    );
  }

  const { error } = await context.supabase.from("purchase_mail_connections").upsert(
    {
      user_id: context.auth.user.id,
      provider: "naver",
      email,
      refresh_token: appPassword,
      access_token: null,
      access_token_expires_at: null,
      sync_after: "2026-07-14T00:00:00+09:00",
      status: "active",
      last_error: null,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id,provider,email",
    }
  );

  if (error) {
    return NextResponse.json(
      {
        error: "네이버 메일 연결 저장에 실패했습니다.",
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    ok: true,
  });
}
