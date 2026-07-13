import { NextResponse } from "next/server";
import { getUserFromAuthorization } from "@/lib/apiAuth";
import { syncGmailPurchaseMails } from "@/lib/gmailPurchaseSync";
import { syncNaverPurchaseMails } from "@/lib/naverPurchaseSync";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { PurchaseHistoryItem } from "@/types/purchaseHistory";

type PurchaseHistoryRow = {
  id: string;
  product_name: string;
  platform: PurchaseHistoryItem["platform"];
  product_url: string | null;
  default_quantity: number | null;
  max_budget_krw: number | null;
  repeat_cycle_days: number | null;
  next_purchase_check_date: string | null;
  source: PurchaseHistoryItem["source"] | null;
  source_message_id: string | null;
  imported_at: string | null;
  auto_repurchase_enabled: boolean;
  last_purchased_at: string;
  memo: string;
  created_at: string;
  updated_at: string;
};

function rowToHistory(row: PurchaseHistoryRow): PurchaseHistoryItem {
  return {
    id: row.id,
    productName: row.product_name,
    platform: row.platform,
    productUrl: row.product_url,
    defaultQuantity: row.default_quantity,
    maxBudgetKrw: row.max_budget_krw,
    repeatCycleDays: row.repeat_cycle_days,
    nextPurchaseCheckDate: row.next_purchase_check_date,
    source: row.source ?? "manual",
    sourceMessageId: row.source_message_id,
    importedAt: row.imported_at,
    autoRepurchaseEnabled: row.auto_repurchase_enabled,
    lastPurchasedAt: row.last_purchased_at,
    memo: row.memo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function POST(request: Request) {
  const auth = await getUserFromAuthorization(request);
  const supabase = createSupabaseAdminClient();

  if (!auth || !supabase) {
    return NextResponse.json(
      {
        error: "로그인이 필요합니다.",
      },
      {
        status: 401,
      }
    );
  }

  const { data: connections, error: connectionError } = await supabase
    .from("purchase_mail_connections")
    .select("*")
    .eq("user_id", auth.user.id)
    .eq("status", "active");

  if (connectionError) {
    return NextResponse.json(
      {
        error: "메일 연결 정보를 불러오지 못했습니다.",
      },
      {
        status: 500,
      }
    );
  }

  if (!connections || connections.length === 0) {
    return NextResponse.json({
      importedCount: 0,
      message: "연결된 메일이 없습니다.",
    });
  }

  const { data: historyRows } = await supabase
    .from("purchase_history")
    .select("*")
    .eq("user_id", auth.user.id);
  const existingHistories = ((historyRows ?? []) as PurchaseHistoryRow[]).map(
    rowToHistory
  );
  let importedCount = 0;
  let messageCount = 0;
  const importedHistories: PurchaseHistoryItem[] = [];

  for (const connection of connections) {
    try {
      const result: {
        importedCount: number;
        messageCount?: number;
        importedHistories: PurchaseHistoryItem[];
      } =
        connection.provider === "gmail"
          ? await syncGmailPurchaseMails({
              supabase,
              connection,
              existingHistories,
            })
          : await syncNaverPurchaseMails({
              supabase,
              connection,
              existingHistories,
            });

      importedCount += result.importedCount;
      messageCount += result.messageCount ?? 0;
      importedHistories.push(...result.importedHistories);
    } catch (error) {
      console.error("Gmail 구매 메일 동기화 실패:", error);

      await supabase
        .from("purchase_mail_connections")
        .update({
          status: "error",
          last_error:
            error instanceof Error
              ? error.message
              : "Gmail 구매 메일 동기화 실패",
          updated_at: new Date().toISOString(),
        })
        .eq("id", connection.id);
    }
  }

  return NextResponse.json({
    importedCount,
    messageCount,
    importedHistories,
  });
}
