export type PurchasePlatform = "coupang" | "other";
export type PurchaseHistorySource = "manual" | "mail" | "agent";

export type PurchaseHistoryItem = {
  id: string;
  productName: string;
  platform: PurchasePlatform;
  productUrl?: string | null;
  defaultQuantity?: number | null;
  maxBudgetKrw?: number | null;
  repeatCycleDays?: number | null;
  nextPurchaseCheckDate?: string | null;
  source?: PurchaseHistorySource;
  sourceMessageId?: string | null;
  importedAt?: string | null;
  autoRepurchaseEnabled: boolean;
  lastPurchasedAt: string;
  memo: string;
  createdAt: string;
  updatedAt: string;
};
