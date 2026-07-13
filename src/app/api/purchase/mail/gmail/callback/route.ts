import { NextResponse } from "next/server";
import { exchangeGoogleCodeForToken } from "@/lib/gmailPurchaseSync";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

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

    await supabase.from("purchase_mail_oauth_states").delete().eq("state", state);
    await supabase.from("purchase_mail_connections").upsert(
      {
        user_id: oauthState.user_id,
        provider: "gmail",
        email: profile?.emailAddress ?? null,
        refresh_token: token.refresh_token ?? null,
        access_token: token.access_token,
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

    return NextResponse.redirect(`${appUrl}/purchase?mail_connected=gmail`);
  } catch (error) {
    console.error("Gmail 연결 실패:", error);

    return NextResponse.redirect(`${appUrl}/purchase?mail_error=gmail`);
  }
}
