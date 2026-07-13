import { ImapFlow } from "imapflow";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPurchaseHistoryFromCandidate } from "@/lib/purchaseAutomation";
import { importPurchaseMailText } from "@/lib/purchaseMailAi";
import type { PurchaseHistoryItem } from "@/types/purchaseHistory";

type NaverMailConnectionRow = {
  id: string;
  user_id: string;
  provider: "naver";
  email: string | null;
  refresh_token: string | null;
  sync_after: string;
};

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

  const client = new ImapFlow({
    host: "imap.naver.com",
    port: 993,
    secure: true,
    auth: {
      user: connection.email,
      pass: connection.refresh_token,
    },
    logger: false,
  });
  const importedHistories: PurchaseHistoryItem[] = [];

  await client.connect();

  try {
    const lock = await client.getMailboxLock("INBOX");

    try {
      const searchSince = new Date(connection.sync_after);
      const uids = await client.search({ since: searchSince });
      const uidList = Array.isArray(uids)
        ? uids.slice(-MAX_NAVER_MESSAGES_PER_SYNC)
        : [];

      for await (const message of client.fetch(uidList, {
        envelope: true,
        source: true,
      })) {
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
      status: "active",
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);

  return {
    importedCount: importedHistories.length,
    importedHistories,
  };
}
