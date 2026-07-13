import { NextResponse } from "next/server";
import { getUserFromAuthorization } from "@/lib/apiAuth";
import { getGoogleGmailAuthUrl } from "@/lib/gmailPurchaseSync";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const auth = await getUserFromAuthorization(request);
  const supabase = createSupabaseAdminClient();

  if (!auth || !supabase) {
    return NextResponse.json(
      {
        error: "로그인이 필요합니다.",
      },
      {
        status: 401,
      }
    );
  }

  const state = crypto.randomUUID();
  const authUrl = getGoogleGmailAuthUrl(state);

  if (!authUrl) {
    return NextResponse.json(
      {
        error:
          "Google OAuth 설정이 없습니다. GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_GMAIL_REDIRECT_URI가 필요합니다.",
      },
      {
        status: 503,
      }
    );
  }

  const { error } = await supabase.from("purchase_mail_oauth_states").insert({
    state,
    user_id: auth.user.id,
    provider: "gmail",
  });

  if (error) {
    return NextResponse.json(
      {
        error: "메일 연결 준비에 실패했습니다.",
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    authUrl,
  });
}
