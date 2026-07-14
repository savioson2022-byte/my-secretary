import { NextResponse } from "next/server";
import { getAuthedSupabaseForRequest } from "@/lib/apiAuth";
import { syncGmailPurchaseMails } from "@/lib/gmailPurchaseSync";
import { syncNaverPurchaseMails } from "@/lib/naverPurchaseSync";
import type { PurchaseHistoryItem } from "@/types/purchaseHistory";

const PURCHASE_MAIL_AUTOMATION_START_AT = "2026-07-14T00:00:00+09:00";

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

type PurchaseMailSyncRequest = {
  backfill?: boolean;
  connectionId?: string;
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

async function readSyncRequestBody(request: Request) {
  try {
    return (await request.json()) as PurchaseMailSyncRequest;
  } catch {
    return {};
  }
}

export async function POST(request: Request) {
  const context = await getAuthedSupabaseForRequest(request);
  const body = await readSyncRequestBody(request);

  if (!context?.supabase) {
    return NextResponse.json(
      {
        error: "로그인이 필요합니다.",
      },
      {
        status: 401,
      }
    );
  }

  const { data: connections, error: connectionError } = await context.supabase
    .from("purchase_mail_connections")
    .select("*")
    .eq("user_id", context.auth.user.id)
    .match(body.connectionId ? { id: body.connectionId } : {});

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

  const targetConnections = connections ?? [];
  const syncableConnections = body.connectionId
    ? targetConnections
    : targetConnections.filter((connection) => connection.status === "active");

  if (syncableConnections.length === 0) {
    return NextResponse.json({
      importedCount: 0,
      message: body.connectionId
        ? "선택한 메일 연결을 찾지 못했습니다."
        : "연결된 메일이 없습니다.",
    });
  }

  const { data: historyRows } = await context.supabase
    .from("purchase_history")
    .select("*")
    .eq("user_id", context.auth.user.id);
  const existingHistories = ((historyRows ?? []) as PurchaseHistoryRow[]).map(
    rowToHistory
  );
  let importedCount = 0;
  let messageCount = 0;
  let failedCount = 0;
  const importedHistories: PurchaseHistoryItem[] = [];

  for (const connection of syncableConnections) {
    const syncConnection = body.backfill
      ? {
          ...connection,
          sync_after: PURCHASE_MAIL_AUTOMATION_START_AT,
        }
      : connection;

    try {
      const result: {
        importedCount: number;
        messageCount?: number;
        importedHistories: PurchaseHistoryItem[];
      } =
        connection.provider === "gmail"
          ? await syncGmailPurchaseMails({
              supabase: context.supabase,
              connection: syncConnection,
              existingHistories,
            })
          : await syncNaverPurchaseMails({
              supabase: context.supabase,
              connection: syncConnection,
              existingHistories,
            });

      importedCount += result.importedCount;
      messageCount += result.messageCount ?? 0;
      importedHistories.push(...result.importedHistories);
    } catch (error) {
      failedCount += 1;
      console.error("구매 메일 동기화 실패:", error);

      await context.supabase
        .from("purchase_mail_connections")
        .update({
          status: "error",
          last_error:
            error instanceof Error
              ? error.message
              : "구매 메일 동기화 실패",
          updated_at: new Date().toISOString(),
        })
        .eq("id", connection.id);
    }
  }

  return NextResponse.json({
    importedCount,
    messageCount,
    failedCount,
    importedHistories,
    message:
      failedCount > 0
        ? "일부 메일 연결을 확인하지 못했습니다. 연결 카드의 안내를 확인해주세요."
        : undefined,
  });
}
