import { NextResponse } from "next/server";
import { decideNextAction } from "@/lib/agentNextAction";
import { sendApplePushNotification, isApnsConfigured } from "@/lib/apns";
import { isFcmConfigured, sendAndroidPushNotification } from "@/lib/fcm";
import { readAgentUserData } from "@/lib/server/agentDataReader";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * 에이전트 루프.
 *
 * 사용자가 앱을 열지 않아도 서버가 "지금 할 것 하나"를 정해 먼저 건넨다.
 * 같은 판단을 하루에 두 번 보내지 않도록 agent_action_deliveries로 막는다.
 */

export const dynamic = "force-dynamic";

type NativeTokenRow = {
  user_id: string;
  token: string;
  platform: string;
};

function isAuthorized(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  const requestSecret = request.headers.get("x-cron-secret");
  const authorization = request.headers.get("authorization") ?? "";
  const userAgent = request.headers.get("user-agent") ?? "";
  const vercelCronSchedule = request.headers.get("x-vercel-cron-schedule");

  const isVercelCronRequest =
    Boolean(vercelCronSchedule) && userAgent.includes("vercel-cron/1.0");
  const hasValidSecret =
    Boolean(expectedSecret) &&
    (requestSecret === expectedSecret ||
      authorization === `Bearer ${expectedSecret}`);

  return isVercelCronRequest || hasValidSecret;
}

/** 미루거나 거절한 제안은 다시 보내지 않는다. */
async function readDismissedActionIds(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  userId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("agent_decisions")
    .select("action_id, kind, wake_at")
    .eq("user_id", userId);

  // 테이블이 아직 없으면 아무것도 제외하지 않는다.
  if (error) return [];

  const now = Date.now();

  return (data ?? [])
    .filter((row) => {
      if (row.kind === "rejected" || row.kind === "approved") return true;
      if (!row.wake_at) return false;

      return new Date(row.wake_at).getTime() > now;
    })
    .map((row) => row.action_id as string);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "잘못된 예약 실행 요청입니다." },
      { status: 401 }
    );
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase 관리자 설정이 필요합니다." },
      { status: 503 }
    );
  }

  if (!isApnsConfigured() && !isFcmConfigured()) {
    return NextResponse.json(
      { ok: true, skipped: "푸시 제공자가 설정되지 않았습니다." },
      { status: 200 }
    );
  }

  // 알림을 받을 수 있는 기기가 있는 사용자만 대상으로 한다.
  const { data: tokenRows, error: tokenError } = await supabase
    .from("native_push_tokens")
    .select("user_id, token, platform")
    .eq("enabled", true);

  if (tokenError) {
    console.error("에이전트 루프 기기 조회 실패", {
      code: tokenError.code,
      message: tokenError.message,
    });

    return NextResponse.json(
      { error: "기기 정보를 불러오지 못했습니다." },
      { status: 500 }
    );
  }

  const tokensByUser = new Map<string, NativeTokenRow[]>();

  for (const row of (tokenRows ?? []) as NativeTokenRow[]) {
    tokensByUser.set(row.user_id, [...(tokensByUser.get(row.user_id) ?? []), row]);
  }

  const todayText = new Date().toISOString().slice(0, 10);
  let decidedCount = 0;
  let sentCount = 0;

  for (const [userId, tokens] of tokensByUser) {
    try {
      const data = await readAgentUserData(supabase, userId);
      const dismissedActionIds = await readDismissedActionIds(supabase, userId);
      const action = decideNextAction({ ...data, dismissedActionIds });

      decidedCount += 1;

      // 급할 것이 없는 날은 굳이 말을 걸지 않는다.
      if (action.kind === "clear") continue;

      const { error: deliveryError } = await supabase
        .from("agent_action_deliveries")
        .insert({
          user_id: userId,
          action_id: action.id,
          action_kind: action.kind,
          occurrence_date: todayText,
          title: action.title,
          body: action.body,
        });

      // unique 제약에 걸리면 이미 보낸 판단이다.
      if (deliveryError) continue;

      for (const tokenRow of tokens) {
        const isAndroid = tokenRow.platform === "android";

        if (isAndroid ? !isFcmConfigured() : !isApnsConfigured()) continue;

        try {
          if (isAndroid) {
            await sendAndroidPushNotification({
              token: tokenRow.token,
              title: action.title,
              body: action.body,
              url: action.url,
              tag: action.id,
            });
          } else {
            await sendApplePushNotification({
              token: tokenRow.token,
              title: action.title,
              body: action.body,
              url: action.url,
              tag: action.id,
            });
          }

          sentCount += 1;
        } catch (error) {
          console.error("에이전트 루프 푸시 실패", { userId, error });
        }
      }
    } catch (error) {
      console.error("에이전트 루프 사용자 처리 실패", { userId, error });
    }
  }

  return NextResponse.json({ ok: true, decidedCount, sentCount });
}
