import { NextResponse } from "next/server";
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

export async function GET(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  const requestSecret = request.headers.get("x-cron-secret");
  const authorization = request.headers.get("authorization") ?? "";
  const userAgent = request.headers.get("user-agent") ?? "";
  const vercelCronSchedule = request.headers.get("x-vercel-cron-schedule");
  const isVercelCronRequest =
    Boolean(vercelCronSchedule) && userAgent.includes("vercel-cron/1.0");
  const hasValidSecret =
    Boolean(expectedSecret) &&
    (requestSecret === expectedSecret ||
      authorization === `Bearer ${expectedSecret}`);

  if (!isVercelCronRequest && !hasValidSecret) {
    return NextResponse.json(
      {
        error: "잘못된 예약 실행 요청입니다.",
      },
      {
        status: 401,
      }
    );
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      {
        error: "Supabase 관리자 설정이 필요합니다.",
      },
      {
        status: 503,
      }
    );
  }

  const { data: connections, error } = await supabase
    .from("purchase_mail_connections")
    .select("*")
    .eq("status", "active");

  if (error) {
    return NextResponse.json(
      {
        error: "메일 연결 정보를 불러오지 못했습니다.",
      },
      {
        status: 500,
      }
    );
  }

  let importedCount = 0;
  let checkedConnections = 0;

  for (const connection of connections ?? []) {
    const { data: historyRows } = await supabase
      .from("purchase_history")
      .select("*")
      .eq("user_id", connection.user_id);
    const existingHistories = ((historyRows ?? []) as PurchaseHistoryRow[]).map(
      rowToHistory
    );

    try {
      const result =
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
      checkedConnections += 1;
    } catch (syncError) {
      await supabase
        .from("purchase_mail_connections")
        .update({
          status: "error",
          last_error:
            syncError instanceof Error
              ? syncError.message
              : "예약 메일 수집 실패",
          updated_at: new Date().toISOString(),
        })
        .eq("id", connection.id);
    }
  }

  return NextResponse.json({
    checkedConnections,
    importedCount,
  });
}
