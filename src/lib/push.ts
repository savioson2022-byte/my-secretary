import webpush from "web-push";

export type PushSubscriptionPayload = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export function getVapidPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
}

export function isWebPushConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.WEB_PUSH_SUBJECT
  );
}

export function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.WEB_PUSH_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  return true;
}

export async function sendPushNotification({
  subscription,
  title,
  body,
  url = "/",
  tag,
  silent = false,
  requireInteraction = true,
}: {
  subscription: PushSubscriptionPayload;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  silent?: boolean;
  requireInteraction?: boolean;
}) {
  if (!configureWebPush()) {
    throw new Error("Web Push 환경변수가 설정되지 않았습니다.");
  }

  await webpush.sendNotification(
    subscription,
    JSON.stringify({
      title,
      body,
      url,
      tag,
      silent,
      requireInteraction,
    })
  );
}
