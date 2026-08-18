import { sign } from "node:crypto";
import type { NativePushPayload } from "@/lib/apns";

let cachedAccessToken: { value: string; expiresAt: number } | null = null;

function base64Url(value: Buffer | string) {
  return Buffer.from(value).toString("base64url");
}

function getFirebasePrivateKey() {
  return process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
}

export function isFcmConfigured() {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      getFirebasePrivateKey()
  );
}

async function getAccessToken() {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.value;
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getFirebasePrivateKey();
  if (!clientEmail || !privateKey) {
    throw new Error("Firebase 서비스 계정 환경변수가 설정되지 않았습니다.");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const unsignedToken = `${header}.${claims}`;
  const signature = sign("RSA-SHA256", Buffer.from(unsignedToken), privateKey);
  const assertion = `${unsignedToken}.${base64Url(signature)}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const result = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!response.ok || !result.access_token) {
    throw new Error(result.error_description || "Firebase 인증에 실패했습니다.");
  }

  cachedAccessToken = {
    value: result.access_token,
    expiresAt: Date.now() + (result.expires_in ?? 3600) * 1000,
  };
  return result.access_token;
}

export async function sendAndroidPushNotification({
  token,
  title,
  body,
  url = "/",
  tag,
  soundEnabled = true,
}: NativePushPayload) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId || !isFcmConfigured()) {
    throw new Error("Firebase 환경변수가 설정되지 않았습니다.");
  }

  const accessToken = await getAccessToken();
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data: { url, tag: tag ?? "" },
          android: {
            priority: "high",
            notification: {
              channel_id: "assistant_reminders",
              ...(soundEnabled ? { sound: "default" } : {}),
              tag,
            },
          },
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error((await response.text()) || `FCM 발송 실패: HTTP ${response.status}`);
  }
}
