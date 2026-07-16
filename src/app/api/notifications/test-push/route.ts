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

  let sentCount = 0;
  let failedCount = 0;
  let nativeSentCount = 0;
  let nativeFailedCount = 0;
  let nativeFailureReason = "";

  for (const subscription of subscriptions ?? []) {
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

  if (nativeTokens && nativeTokens.length > 0 && isApnsConfigured()) {
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
      } catch (error) {
        nativeFailedCount += 1;
        nativeFailureReason =
          error instanceof Error
            ? error.message
            : "아이폰 앱 푸시 발송에 실패했습니다.";
      }
    }
  }

  const totalSentCount = sentCount + nativeSentCount;
  const webPushSubscriptionCount = subscriptions?.length ?? 0;
  const nativePushTokenCount = nativeTokens?.length ?? 0;

  return NextResponse.json({
    ok: totalSentCount > 0,
    sentCount: totalSentCount,
    webSentCount: sentCount,
    nativeSentCount,
    failedCount: failedCount + nativeFailedCount,
    webFailedCount: failedCount,
    nativeFailedCount,
    webPushSubscriptionCount,
    nativePushTokenCount,
    apnsConfigured: isApnsConfigured(),
    reason:
      totalSentCount > 0
        ? null
        : nativePushTokenCount > 0 && nativeFailureReason
        ? `아이폰 앱 푸시 발송에 실패했습니다. ${nativeFailureReason}`
        : nativePushTokenCount > 0 && !isApnsConfigured()
        ? "아이폰 앱 푸시 토큰은 연결됐지만, Apple APNs 발송키 설정이 필요합니다."
        : "서버 푸시 발송에 실패했습니다. 아이폰 앱 토큰 또는 웹 푸시 연결 상태를 확인해야 합니다.",
  });
}
