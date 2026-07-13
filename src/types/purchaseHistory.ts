export type PurchasePlatform = "coupang" | "other";

export type PurchaseHistoryItem = {
  id: string;
  productName: string;
  platform: PurchasePlatform;
  productUrl?: string | null;
  defaultQuantity?: number | null;
  maxBudgetKrw?: number | null;
  repeatCycleDays?: number | null;
  nextPurchaseCheckDate?: string | null;
  autoRepurchaseEnabled: boolean;
  lastPurchasedAt: string;
  memo: string;
  createdAt: string;
  updatedAt: string;
};
