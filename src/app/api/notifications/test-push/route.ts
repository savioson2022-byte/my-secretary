import { NextResponse } from "next/server";
import { getAuthedSupabaseForRequest } from "@/lib/apiAuth";
import { sendPushNotification } from "@/lib/push";

type PushSubscriptionRecord = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function POST(request: Request) {
  const context = await getAuthedSupabaseForRequest(request);

  if (!context) {
    return NextResponse.json(
      { ok: false, reason: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  if (!context.supabase) {
    return NextResponse.json(
      { ok: false, reason: "Supabase 설정이 필요합니다." },
      { status: 500 }
    );
  }

  const { data: subscriptions, error } = await context.supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", context.auth.user.id)
    .eq("enabled", true)
    .returns<PushSubscriptionRecord[]>();

  if (error) {
    return NextResponse.json(
      { ok: false, reason: error.message },
      { status: 500 }
    );
  }

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({
      ok: false,
      reason: "이 기기에 저장된 서버 푸시 연결이 없습니다. 먼저 알림 권한을 켜주세요.",
    });
  }

  let sentCount = 0;
  let failedCount = 0;

  for (const subscription of subscriptions) {
    try {
      await sendPushNotification({
        subscription: {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        title: "나의 비서 서버 푸시 테스트",
        body: "서버에서 보내는 푸시 알림도 정상으로 연결됐어요.",
        url: "/settings",
        tag: `server-test-${Date.now()}`,
      });
      sentCount += 1;
    } catch {
      failedCount += 1;
      await context.supabase
        .from("push_subscriptions")
        .update({
          enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscription.id)
        .eq("user_id", context.auth.user.id);
    }
  }

  return NextResponse.json({
    ok: sentCount > 0,
    sentCount,
    failedCount,
    reason:
      sentCount > 0
        ? null
        : "서버 푸시 발송에 실패했습니다. 푸시 환경값이나 기기 구독 상태를 확인해야 합니다.",
  });
}
