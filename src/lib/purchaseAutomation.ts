import type { MailImportCandidate } from "@/lib/purchaseMailImport";
import { normalizePurchaseName } from "@/lib/purchaseHistoryStorage";
import type { PurchaseHistoryItem } from "@/types/purchaseHistory";

export const PURCHASE_AUTOMATION_START_DATE = "2026-07-14";

export type PurchaseCycleEstimate = {
  repeatCycleDays: number | null;
  nextPurchaseCheckDate: string | null;
  confidence: "low" | "medium" | "high";
};

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

function getDateOnly(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getCandidateKey(productName: string) {
  return normalizePurchaseName(productName).slice(0, 24);
}

function daysBetween(left: Date, right: Date) {
  return Math.round((right.getTime() - left.getTime()) / 86400000);
}

export function estimatePurchaseCycle({
  productName,
  purchasedAt,
  histories,
}: {
  productName: string;
  purchasedAt: Date;
  histories: PurchaseHistoryItem[];
}): PurchaseCycleEstimate {
  const key = getCandidateKey(productName);
  const matchingHistories = histories
    .filter((history) => {
      return getCandidateKey(history.productName) === key;
    })
    .sort((left, right) => {
      return (
        new Date(left.lastPurchasedAt).getTime() -
        new Date(right.lastPurchasedAt).getTime()
      );
    });

  const previousHistory = matchingHistories.at(-1);

  if (previousHistory?.repeatCycleDays) {
    return {
      repeatCycleDays: previousHistory.repeatCycleDays,
      nextPurchaseCheckDate: toDateInputValue(
        addDays(purchasedAt, previousHistory.repeatCycleDays)
      ),
      confidence: "high",
    };
  }

  if (previousHistory) {
    const previousDate = new Date(previousHistory.lastPurchasedAt);
    const interval = daysBetween(previousDate, purchasedAt);

    if (interval >= 7 && interval <= 365) {
      return {
        repeatCycleDays: interval,
        nextPurchaseCheckDate: toDateInputValue(addDays(purchasedAt, interval)),
        confidence: "medium",
      };
    }
  }

  return {
    repeatCycleDays: null,
    nextPurchaseCheckDate: null,
    confidence: "low",
  };
}

export function createPurchaseHistoryFromCandidate({
  candidate,
  histories,
  messageId,
  purchasedAt,
}: {
  candidate: MailImportCandidate;
  histories: PurchaseHistoryItem[];
  messageId: string;
  purchasedAt: Date;
}): PurchaseHistoryItem {
  const now = new Date().toISOString();
  const quantity = candidate.quantityText
    ? Number(candidate.quantityText.replace(/[^0-9]/g, ""))
    : 0;
  const maxBudget = candidate.priceText
    ? Number(candidate.priceText.replace(/[^0-9]/g, ""))
    : 0;
  const cycle = estimatePurchaseCycle({
    productName: candidate.productName,
    purchasedAt,
    histories,
  });

  return {
    id: crypto.randomUUID(),
    productName: candidate.productName,
    platform: "coupang",
    productUrl: candidate.productUrl || null,
    defaultQuantity: Number.isFinite(quantity) && quantity > 0 ? quantity : null,
    maxBudgetKrw: Number.isFinite(maxBudget) && maxBudget > 0 ? maxBudget : null,
    repeatCycleDays: cycle.repeatCycleDays,
    nextPurchaseCheckDate: cycle.nextPurchaseCheckDate,
    source: "mail",
    sourceMessageId: messageId,
    importedAt: now,
    autoRepurchaseEnabled: true,
    lastPurchasedAt: purchasedAt.toISOString(),
    memo: `쿠팡 메일 자동 수집 · 주기 추정 ${cycle.confidence}`,
    createdAt: now,
    updatedAt: now,
  };
}

export function getNextPurchaseDateFromToday(history: PurchaseHistoryItem) {
  if (!history.repeatCycleDays || history.repeatCycleDays <= 0) return null;

  return toDateInputValue(addDays(new Date(), history.repeatCycleDays));
}

export function isRepurchaseDue(history: PurchaseHistoryItem, now = new Date()) {
  if (!history.autoRepurchaseEnabled || !history.nextPurchaseCheckDate) {
    return false;
  }

  const targetDate = new Date(`${history.nextPurchaseCheckDate}T00:00:00`);

  if (Number.isNaN(targetDate.getTime())) {
    return false;
  }

  return targetDate.getTime() <= getDateOnly(now).getTime();
}

export function getDueRepurchaseHistories(
  histories: PurchaseHistoryItem[],
  limit = 3
) {
  return histories
    .filter((history) => isRepurchaseDue(history))
    .sort((left, right) => {
      return String(left.nextPurchaseCheckDate).localeCompare(
        String(right.nextPurchaseCheckDate)
      );
    })
    .slice(0, limit);
}
