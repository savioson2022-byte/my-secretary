import { NextResponse } from "next/server";
import { getAuthedSupabaseForRequest } from "@/lib/apiAuth";
import { syncGmailPurchaseMails } from "@/lib/gmailPurchaseSync";
import { syncNaverPurchaseMails } from "@/lib/naverPurchaseSync";
import { getPurchaseMailBackfillSyncAfter } from "@/lib/purchaseMailSyncWindow";
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
  let analyzedMessageCount = 0;
  let failedCount = 0;
  const importedHistories: PurchaseHistoryItem[] = [];
  const failedExtractionSubjects: string[] = [];
  const skippedCoupangSubjects: string[] = [];

  for (const connection of syncableConnections) {
    const syncConnection = body.backfill
      ? {
          ...connection,
          sync_after: getPurchaseMailBackfillSyncAfter(),
        }
      : connection;

    try {
      const result: {
        importedCount: number;
        messageCount?: number;
        analyzedMessageCount?: number;
        importedHistories: PurchaseHistoryItem[];
        failedExtractionSubjects?: string[];
        skippedCoupangSubjects?: string[];
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
              forceReprocess: Boolean(body.backfill),
            });

      importedCount += result.importedCount;
      messageCount += result.messageCount ?? 0;
      analyzedMessageCount += result.analyzedMessageCount ?? 0;
      importedHistories.push(...result.importedHistories);
      failedExtractionSubjects.push(...(result.failedExtractionSubjects ?? []));
      skippedCoupangSubjects.push(...(result.skippedCoupangSubjects ?? []));
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
    analyzedMessageCount,
    failedCount,
    importedHistories,
    failedExtractionSubjects: failedExtractionSubjects.slice(0, 5),
    skippedCoupangSubjects: skippedCoupangSubjects.slice(0, 5),
    message:
      failedCount > 0
        ? "일부 메일 연결을 확인하지 못했습니다. 연결 카드의 안내를 확인해주세요."
        : messageCount > 0 && importedCount === 0
          ? `${body.backfill ? "기존 메일을 다시 확인했어. " : ""}쿠팡 메일 ${messageCount}개 중 주문 가능성이 높은 메일 ${analyzedMessageCount}개를 분석했지만 구매템은 아직 저장하지 못했어.${failedExtractionSubjects.length > 0 ? ` 분석 실패 예: ${failedExtractionSubjects.slice(0, 2).join(" / ")}` : skippedCoupangSubjects.length > 0 ? ` 제외한 메일 예: ${skippedCoupangSubjects.slice(0, 2).join(" / ")}` : ""}`
        : undefined,
  });
}
