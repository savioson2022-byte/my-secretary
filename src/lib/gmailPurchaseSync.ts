import type { SupabaseClient } from "@supabase/supabase-js";
import { createPurchaseHistoryFromCandidate } from "@/lib/purchaseAutomation";
import { importPurchaseMailText } from "@/lib/purchaseMailAi";
import { getNextPurchaseMailSyncAfter } from "@/lib/purchaseMailSyncWindow";
import type { PurchaseHistoryItem } from "@/types/purchaseHistory";

type GmailTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
};

type GmailMessagePart = {
  mimeType?: string;
  body?: {
    data?: string;
  };
  parts?: GmailMessagePart[];
};

type GmailMessage = {
  id: string;
  internalDate?: string;
  payload?: GmailMessagePart & {
    headers?: Array<{
      name: string;
      value: string;
    }>;
  };
};

type MailConnectionRow = {
  id: string;
  user_id: string;
  provider: "gmail";
  email: string | null;
  refresh_token: string | null;
  access_token: string | null;
  access_token_expires_at: string | null;
  sync_after: string;
};

const MAX_GMAIL_MESSAGES_PER_SYNC = 100;

function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_GMAIL_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_APP_URL ?? "https://my-secretary-remote.vercel.app"}/api/purchase/mail/gmail/callback`;

  if (!clientId || !clientSecret) return null;

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
}

function decodeBase64Url(data: string) {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );

  return Buffer.from(padded, "base64").toString("utf8");
}

function extractTextFromPart(part?: GmailMessagePart): string {
  if (!part) return "";

  const currentText =
    part.mimeType?.startsWith("text/") && part.body?.data
      ? decodeBase64Url(part.body.data)
      : "";
  const childText = part.parts?.map(extractTextFromPart).join("\n") ?? "";

  return [currentText, childText].filter(Boolean).join("\n");
}

function getHeader(message: GmailMessage, name: string) {
  return (
    message.payload?.headers?.find((header) => {
      return header.name.toLowerCase() === name.toLowerCase();
    })?.value ?? null
  );
}

async function refreshGmailAccessToken(connection: MailConnectionRow) {
  const config = getGoogleOAuthConfig();

  if (!config || !connection.refresh_token) {
    throw new Error("Gmail 연결 정보가 없습니다.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: connection.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error("Gmail 토큰 갱신에 실패했습니다.");
  }

  const token = (await response.json()) as GmailTokenResponse;
  const expiresAt = new Date(Date.now() + token.expires_in * 1000);

  return {
    accessToken: token.access_token,
    expiresAt: expiresAt.toISOString(),
  };
}

async function getFreshAccessToken({
  connection,
  supabase,
}: {
  connection: MailConnectionRow;
  supabase: SupabaseClient;
}) {
  const expiresAt = connection.access_token_expires_at
    ? new Date(connection.access_token_expires_at).getTime()
    : 0;

  if (connection.access_token && expiresAt > Date.now() + 60000) {
    return connection.access_token;
  }

  const refreshed = await refreshGmailAccessToken(connection);

  await supabase
    .from("purchase_mail_connections")
    .update({
      access_token: refreshed.accessToken,
      access_token_expires_at: refreshed.expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);

  return refreshed.accessToken;
}

async function fetchGmailMessageIds({
  accessToken,
  syncAfter,
}: {
  accessToken: string;
  syncAfter: string;
}) {
  const afterDate = new Date(syncAfter);
  const afterQuery = `${afterDate.getFullYear()}/${afterDate.getMonth() + 1}/${afterDate.getDate()}`;
  const messageIds: string[] = [];
  let pageToken: string | undefined;

  do {
    const gmailUrl = new URL(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages"
    );

    gmailUrl.searchParams.set(
      "q",
      `after:${afterQuery} (from:coupang OR from:no-reply@coupang.com OR subject:쿠팡 OR subject:Coupang)`
    );
    gmailUrl.searchParams.set("maxResults", "50");

    if (pageToken) {
      gmailUrl.searchParams.set("pageToken", pageToken);
    }

    const response = await fetch(gmailUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Gmail 메일 목록을 가져오지 못했습니다.");
    }

    const data = (await response.json()) as {
      messages?: Array<{ id: string }>;
      nextPageToken?: string;
    };

    messageIds.push(...(data.messages?.map((message) => message.id) ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken && messageIds.length < MAX_GMAIL_MESSAGES_PER_SYNC);

  return messageIds.slice(0, MAX_GMAIL_MESSAGES_PER_SYNC);
}

async function fetchGmailMessage({
  accessToken,
  messageId,
}: {
  accessToken: string;
  messageId: string;
}) {
  const messageUrl = new URL(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`
  );

  messageUrl.searchParams.set("format", "full");

  const response = await fetch(messageUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Gmail 메일 본문을 가져오지 못했습니다.");
  }

  return (await response.json()) as GmailMessage;
}

export function getGoogleGmailAuthUrl(state: string) {
  const config = getGoogleOAuthConfig();

  if (!config) return null;

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");

  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", config.redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set(
    "scope",
    "https://www.googleapis.com/auth/gmail.readonly"
  );

  return authUrl.toString();
}

export async function exchangeGoogleCodeForToken(code: string) {
  const config = getGoogleOAuthConfig();

  if (!config) {
    throw new Error("Google OAuth 설정이 없습니다.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error("Google 인증 코드를 토큰으로 바꾸지 못했습니다.");
  }

  return (await response.json()) as GmailTokenResponse;
}

export async function syncGmailPurchaseMails({
  supabase,
  connection,
  existingHistories,
}: {
  supabase: SupabaseClient;
  connection: MailConnectionRow;
  existingHistories: PurchaseHistoryItem[];
}) {
  const accessToken = await getFreshAccessToken({ connection, supabase });
  const messageIds = await fetchGmailMessageIds({
    accessToken,
    syncAfter: connection.sync_after,
  });
  const importedHistories: PurchaseHistoryItem[] = [];

  for (const messageId of messageIds) {
    const { data: existingImport } = await supabase
      .from("purchase_mail_imports")
      .select("id, candidate_count")
      .eq("user_id", connection.user_id)
      .eq("provider", "gmail")
      .eq("message_id", messageId)
      .maybeSingle();

    if (existingImport && Number(existingImport.candidate_count) > 0) {
      continue;
    }

    const message = await fetchGmailMessage({ accessToken, messageId });
    const subject = getHeader(message, "subject");
    const sentAt = message.internalDate
      ? new Date(Number(message.internalDate))
      : new Date();
    const text = extractTextFromPart(message.payload);
    const result = await importPurchaseMailText(
      [subject, text].filter(Boolean).join("\n")
    );
    const nextHistories = [...existingHistories, ...importedHistories];
    const histories = result.candidates.map((candidate) => {
      return createPurchaseHistoryFromCandidate({
        candidate,
        histories: nextHistories,
        messageId,
        purchasedAt: sentAt,
      });
    });

    if (histories.length > 0) {
      await supabase.from("purchase_history").upsert(
        histories.map((history) => ({
          id: history.id,
          user_id: connection.user_id,
          product_name: history.productName,
          platform: history.platform,
          product_url: history.productUrl,
          default_quantity: history.defaultQuantity,
          max_budget_krw: history.maxBudgetKrw,
          repeat_cycle_days: history.repeatCycleDays,
          next_purchase_check_date: history.nextPurchaseCheckDate,
          source: history.source,
          source_message_id: history.sourceMessageId,
          imported_at: history.importedAt,
          auto_repurchase_enabled: history.autoRepurchaseEnabled,
          last_purchased_at: history.lastPurchasedAt,
          memo: history.memo,
          created_at: history.createdAt,
          updated_at: history.updatedAt,
        }))
      );

      importedHistories.push(...histories);
    }

    await supabase.from("purchase_mail_imports").upsert(
      {
        user_id: connection.user_id,
        connection_id: connection.id,
        provider: "gmail",
        message_id: messageId,
        subject,
        sent_at: sentAt.toISOString(),
        candidate_count: histories.length,
        imported_product_names: histories.map((history) => history.productName),
      },
      {
        onConflict: "user_id,provider,message_id",
      }
    );
  }

  await supabase
    .from("purchase_mail_connections")
    .update({
      last_sync_at: new Date().toISOString(),
      sync_after: getNextPurchaseMailSyncAfter(),
      status: "active",
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);

  return {
    importedCount: importedHistories.length,
    messageCount: messageIds.length,
    importedHistories,
  };
}
