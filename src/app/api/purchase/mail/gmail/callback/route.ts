import { NextResponse } from "next/server";
import { exchangeGoogleCodeForToken } from "@/lib/gmailPurchaseSync";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { encryptToken } from "@/lib/tokenEncryption";

async function getGmailProfile(accessToken: string) {
  const response = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) return null;

  return (await response.json()) as {
    emailAddress?: string;
  };
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://my-secretary-remote.vercel.app";

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/purchase?mail_error=missing_code`);
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.redirect(`${appUrl}/purchase?mail_error=no_supabase`);
  }

  const { data: oauthState, error: stateError } = await supabase
    .from("purchase_mail_oauth_states")
    .select("state, user_id, provider, expires_at")
    .eq("state", state)
    .eq("provider", "gmail")
    .maybeSingle();

  if (
    stateError ||
    !oauthState ||
    new Date(oauthState.expires_at).getTime() < Date.now()
  ) {
    return NextResponse.redirect(`${appUrl}/purchase?mail_error=expired_state`);
  }

  try {
    const token = await exchangeGoogleCodeForToken(code);
    const profile = await getGmailProfile(token.access_token);
    const expiresAt = new Date(Date.now() + token.expires_in * 1000);

    const emailToSave = profile?.emailAddress;
    if (!emailToSave) {
      console.error("Gmail 프로필에서 이메일을 가져올 수 없습니다.");
      return NextResponse.redirect(`${appUrl}/purchase?mail_error=gmail_no_email`);
    }

    // 기존 연결이 있다면 조회 (refresh token 보존 목적)
    const { data: existingConnection, error: existingError } = await supabase
      .from("purchase_mail_connections")
      .select("refresh_token")
      .eq("user_id", oauthState.user_id)
      .eq("provider", "gmail")
      .eq("email", emailToSave)
      .maybeSingle();

    if (existingError) {
      console.error("Gmail 기존 연결 조회 실패", existingError);
      return NextResponse.redirect(`${appUrl}/purchase?mail_error=gmail_db_query`);
    }

    const refreshTokenToSave = token.refresh_token
      ? encryptToken(token.refresh_token)
      : existingConnection?.refresh_token ?? null;

    const { error: upsertError } = await supabase.from("purchase_mail_connections").upsert(
      {
        user_id: oauthState.user_id,
        provider: "gmail",
        email: emailToSave,
        refresh_token: refreshTokenToSave,
        access_token: encryptToken(token.access_token),
        access_token_expires_at: expiresAt.toISOString(),
        sync_after: "2026-07-14T00:00:00+09:00",
        status: "active",
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,provider,email",
      }
    );

    if (upsertError) {
      console.error("Gmail 연결 정보 저장 실패", upsertError);
      return NextResponse.redirect(`${appUrl}/purchase?mail_error=gmail_db_save`);
    }

    const { error: stateDeleteError } = await supabase
      .from("purchase_mail_oauth_states")
      .delete()
      .eq("state", state);

    if (stateDeleteError) {
      console.error("Gmail OAuth state 정리 실패", stateDeleteError);
    }

    return NextResponse.redirect(`${appUrl}/purchase?mail_connected=gmail`);
  } catch (error) {
    console.error(
      "Gmail 연결 실패:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.redirect(`${appUrl}/purchase?mail_error=gmail`);
  }
}
