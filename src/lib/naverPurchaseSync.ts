import { ImapFlow } from "imapflow";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPurchaseHistoryFromCandidate } from "@/lib/purchaseAutomation";
import { importPurchaseMailText } from "@/lib/purchaseMailAi";
import { getNextPurchaseMailSyncAfter } from "@/lib/purchaseMailSyncWindow";
import type { PurchaseHistoryItem } from "@/types/purchaseHistory";

type NaverMailConnectionRow = {
  id: string;
  user_id: string;
  provider: "naver";
  email: string | null;
  refresh_token: string | null;
  sync_after: string;
};

function createNaverMailClient({
  email,
  appPassword,
}: {
  email: string;
  appPassword: string;
}) {
  return new ImapFlow({
    host: "imap.naver.com",
    port: 993,
    secure: true,
    auth: {
      user: email,
      pass: appPassword,
    },
    logger: false,
  });
}

function getReadableNaverMailError(error: unknown) {
  const response =
    typeof error === "object" && error && "response" in error
      ? String((error as { response?: unknown }).response ?? "")
      : "";
  const responseText =
    typeof error === "object" && error && "responseText" in error
      ? String((error as { responseText?: unknown }).responseText ?? "")
      : "";
  const message = error instanceof Error ? error.message : String(error);
  const combined = `${message} ${response} ${responseText}`;

  if (/authentication failed|AUTH|password|login/i.test(combined)) {
    return "네이버 메일 로그인에 실패했습니다. 네이버 메일의 IMAP/SMTP 사용 설정을 켜고, 계정 비밀번호가 아니라 새로 발급한 앱 비밀번호를 입력해주세요.";
  }

  if (/timed out|timeout|network|connection/i.test(combined)) {
    return "네이버 메일 서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.";
  }

  if (/command failed/i.test(combined)) {
    return "네이버 메일 서버가 요청을 거절했습니다. IMAP 사용 설정과 앱 비밀번호를 확인해주세요.";
  }

  return message || "네이버 메일을 확인하지 못했습니다.";
}

export async function verifyNaverMailConnection({
  email,
  appPassword,
}: {
  email: string;
  appPassword: string;
}) {
  const client = createNaverMailClient({ email, appPassword });

  try {
    await client.connect();
  } catch (error) {
    throw new Error(getReadableNaverMailError(error));
  } finally {
    try {
      await client.logout();
    } catch {
      // Connection may have failed before login completed.
    }
  }
}

function isCoupangMail({
  subject,
  from,
}: {
  subject?: string;
  from?: string;
}) {
  return /쿠팡|coupang/i.test(`${subject ?? ""} ${from ?? ""}`);
}

const MAX_NAVER_MESSAGES_PER_SYNC = 200;

export async function syncNaverPurchaseMails({
  supabase,
  connection,
  existingHistories,
}: {
  supabase: SupabaseClient;
  connection: NaverMailConnectionRow;
  existingHistories: PurchaseHistoryItem[];
}) {
  if (!connection.email || !connection.refresh_token) {
    throw new Error("네이버 메일 주소와 앱 비밀번호가 필요합니다.");
  }

  const client = createNaverMailClient({
    email: connection.email,
    appPassword: connection.refresh_token,
  });
  const importedHistories: PurchaseHistoryItem[] = [];
  let messageCount = 0;

  try {
    await client.connect();
  } catch (error) {
    throw new Error(getReadableNaverMailError(error));
  }

  try {
    const lock = await client.getMailboxLock("INBOX");

    try {
      const searchSince = new Date(connection.sync_after);
      const uids = await client.search({ since: searchSince });
      const uidList = Array.isArray(uids)
        ? uids.slice(-MAX_NAVER_MESSAGES_PER_SYNC)
        : [];
      messageCount = uidList.length;

      for await (const message of uidList.length > 0
        ? client.fetch(uidList, {
            envelope: true,
            source: true,
          })
        : []) {
        const messageId = String(message.uid);
        const subject = message.envelope?.subject ?? "";
        const from = message.envelope?.from
          ?.map((address) => address.address ?? address.name ?? "")
          .join(", ");

        if (!isCoupangMail({ subject, from })) continue;

        const { data: existingImport } = await supabase
          .from("purchase_mail_imports")
          .select("id")
          .eq("user_id", connection.user_id)
          .eq("provider", "naver")
          .eq("message_id", messageId)
          .maybeSingle();

        if (existingImport) continue;

        const sentAt = message.envelope?.date ?? new Date();
        const sourceText = message.source?.toString("utf8") ?? "";
        const result = await importPurchaseMailText(`${subject}\n${sourceText}`);
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

        await supabase.from("purchase_mail_imports").insert({
          user_id: connection.user_id,
          connection_id: connection.id,
          provider: "naver",
          message_id: messageId,
          subject,
          sent_at: sentAt.toISOString(),
          candidate_count: histories.length,
          imported_product_names: histories.map((history) => history.productName),
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
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
    messageCount,
    importedHistories,
  };
}
