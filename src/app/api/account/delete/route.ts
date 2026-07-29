import { NextResponse } from "next/server";
import { getUserFromAuthorization } from "@/lib/apiAuth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const auth = await getUserFromAuthorization(request);
  const admin = createSupabaseAdminClient();

  if (!auth) {
    return NextResponse.json(
      { ok: false, error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "계정 삭제 서버 설정이 필요합니다." },
      { status: 503 }
    );
  }

  const { data: identity, error: identityError } = await admin
    .from("account_identities")
    .select("app_account_id")
    .eq("auth_user_id", auth.user.id)
    .maybeSingle<{ app_account_id: string }>();

  if (identityError) {
    console.error("계정 연결 정보 조회 실패", identityError);
    return NextResponse.json(
      { ok: false, error: "계정 정보를 확인하지 못했습니다." },
      { status: 500 }
    );
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(auth.user.id);

  if (deleteError) {
    console.error("Supabase 계정 삭제 실패", deleteError.message);
    return NextResponse.json(
      {
        ok: false,
        error:
          "계정을 삭제하지 못했습니다. 잠시 후 다시 시도하거나 지원 페이지로 문의해주세요.",
      },
      { status: 500 }
    );
  }

  if (identity?.app_account_id) {
    const { count, error: countError } = await admin
      .from("account_identities")
      .select("id", { count: "exact", head: true })
      .eq("app_account_id", identity.app_account_id);

    if (!countError && count === 0) {
      const { error: accountDeleteError } = await admin
        .from("app_accounts")
        .delete()
        .eq("id", identity.app_account_id);

      if (accountDeleteError) {
        console.error("빈 통합계정 정리 실패", accountDeleteError);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
