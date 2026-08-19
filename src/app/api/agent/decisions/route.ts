import { NextResponse } from "next/server";
import { getUserFromAuthorization } from "@/lib/apiAuth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * 사용자가 미루거나 거절한 제안을 서버에도 남긴다.
 *
 * 이게 없으면 앱에서 "이건 아니에요"를 눌러도 서버 루프는 그 사실을 모른 채
 * 같은 제안을 다시 푸시한다. 그러면 사용자는 알림을 통째로 꺼버린다.
 */

export const dynamic = "force-dynamic";

type DecisionBody = {
  actionId?: string;
  kind?: "approved" | "snoozed" | "rejected";
  wakeAt?: string | null;
};

export async function POST(request: Request) {
  const auth = await getUserFromAuthorization(request);
  const supabase = createSupabaseAdminClient();

  if (!auth || !supabase) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as DecisionBody;
  const actionId = body.actionId?.trim();
  const kind = body.kind;

  if (!actionId || !kind) {
    return NextResponse.json(
      { error: "actionId와 kind가 필요합니다." },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("agent_decisions").upsert(
    {
      user_id: auth.user.id,
      action_id: actionId,
      kind,
      wake_at: body.wakeAt ?? null,
      decided_at: new Date().toISOString(),
    },
    { onConflict: "user_id,action_id" }
  );

  if (error) {
    // 테이블이 아직 없어도 앱 동작을 막지 않는다. 로컬 기록은 이미 남아 있다.
    console.error("에이전트 결정 저장 실패", {
      code: error.code,
      message: error.message,
    });

    return NextResponse.json({ ok: false }, { status: 200 });
  }

  return NextResponse.json({ ok: true });
}
