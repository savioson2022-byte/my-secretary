import { connect } from "node:http2";
import { sign } from "node:crypto";

export type NativePushPayload = {
  token: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  soundEnabled?: boolean;
};

function base64Url(value: Buffer | string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function getApnsPrivateKey() {
  return process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, "\n");
}

export function isApnsConfigured() {
  return Boolean(
    process.env.APNS_KEY_ID &&
      process.env.APNS_TEAM_ID &&
      process.env.APNS_BUNDLE_ID &&
      getApnsPrivateKey()
  );
}

function createApnsJwt() {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const privateKey = getApnsPrivateKey();

  if (!keyId || !teamId || !privateKey) {
    throw new Error("APNs 환경변수가 설정되지 않았습니다.");
  }

  const header = base64Url(
    JSON.stringify({
      alg: "ES256",
      kid: keyId,
    })
  );
  const payload = base64Url(
    JSON.stringify({
      iss: teamId,
      iat: Math.floor(Date.now() / 1000),
    })
  );
  const data = `${header}.${payload}`;
  const signature = sign("sha256", Buffer.from(data), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  });

  return `${data}.${base64Url(signature)}`;
}

export async function sendApplePushNotification({
  token,
  title,
  body,
  url = "/",
  tag,
  soundEnabled = true,
}: NativePushPayload) {
  if (!isApnsConfigured()) {
    throw new Error("APNs 환경변수가 설정되지 않았습니다.");
  }

  const bundleId = process.env.APNS_BUNDLE_ID;
  const isProduction = process.env.APNS_ENV === "production";
  const host = isProduction
    ? "https://api.push.apple.com"
    : "https://api.sandbox.push.apple.com";
  const jwt = createApnsJwt();
  const payload = JSON.stringify({
    aps: {
      alert: {
        title,
        body,
      },
      ...(soundEnabled ? { sound: "default" } : {}),
    },
    url,
    tag,
  });

  await new Promise<void>((resolve, reject) => {
    const client = connect(host);
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });

    let responseBody = "";

    req.setEncoding("utf8");
    req.on("response", (headers) => {
      const status = Number(headers[":status"] ?? 0);

      req.on("data", (chunk) => {
        responseBody += chunk;
      });
      req.on("end", () => {
        client.close();
        if (status >= 200 && status < 300) {
          resolve();
          return;
        }

        reject(
          new Error(
            responseBody || `APNs 발송 실패: HTTP ${status || "unknown"}`
          )
        );
      });
    });
    req.on("error", (error) => {
      client.close();
      reject(error);
    });
    client.on("error", (error) => {
      client.close();
      reject(error);
    });
    req.end(payload);
  });
}
