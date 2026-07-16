import { NextResponse } from "next/server";
import { getAuthedSupabaseForRequest } from "@/lib/apiAuth";
import {
  isApnsConfigured,
  sendApplePushNotification,
} from "@/lib/apns";
import { sendPushNotification } from "@/lib/push";

type PushSubscriptionRecord = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type NativePushTokenRecord = {
  id: string;
  token: string;
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

  const { data: nativeTokens } = await context.supabase
    .from("native_push_tokens")
    .select("id, token")
    .eq("user_id", context.auth.user.id)
    .eq("enabled", true)
    .returns<NativePushTokenRecord[]>();

  if (!subscriptions || subscriptions.length === 0) {
    if (nativeTokens && nativeTokens.length > 0 && isApnsConfigured()) {
      let nativeSentCount = 0;
      let nativeFailedCount = 0;

      for (const nativeToken of nativeTokens) {
        try {
          await sendApplePushNotification({
            token: nativeToken.token,
            title: "나의 비서 앱 푸시 테스트",
            body: "아이폰 앱 푸시가 서버에서 정상으로 도착했어요.",
            url: "/settings",
            tag: `native-server-test-${Date.now()}`,
          });
          nativeSentCount += 1;
        } catch {
          nativeFailedCount += 1;
          await context.supabase
            .from("native_push_tokens")
            .update({
              enabled: false,
              updated_at: new Date().toISOString(),
            })
            .eq("id", nativeToken.id)
            .eq("user_id", context.auth.user.id);
        }
      }

      return NextResponse.json({
        ok: nativeSentCount > 0,
        sentCount: nativeSentCount,
        failedCount: nativeFailedCount,
        webPushSubscriptionCount: 0,
        nativePushTokenCount: nativeTokens.length,
        apnsConfigured: true,
        reason:
          nativeSentCount > 0
            ? null
            : "아이폰 앱 푸시 발송에 실패했습니다. APNs 키와 앱 Bundle ID를 확인해야 합니다.",
      });
    }

    return NextResponse.json({
      ok: false,
      webPushSubscriptionCount: 0,
      nativePushTokenCount: nativeTokens?.length ?? 0,
      apnsConfigured: isApnsConfigured(),
      reason:
        nativeTokens && nativeTokens.length > 0
          ? "아이폰 앱 푸시 토큰은 연결됐지만, 실제 원격 푸시 발송에는 Apple APNs 발송키 설정이 추가로 필요합니다."
          : "이 계정에 저장된 웹 푸시 연결이 없습니다. 앱에서는 아이폰 푸시 토큰 연결이 먼저 필요합니다.",
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
    webPushSubscriptionCount: subscriptions.length,
    nativePushTokenCount: nativeTokens?.length ?? 0,
    apnsConfigured: isApnsConfigured(),
    reason:
      sentCount > 0
        ? null
        : "서버 푸시 발송에 실패했습니다. 푸시 환경값이나 기기 구독 상태를 확인해야 합니다.",
  });
}
