import {
  createLocalStorageRepository,
  isBrowser,
} from "@/lib/localStorageRepository";
import { normalizePurchaseName } from "@/lib/purchaseName";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import type { PurchaseHistoryItem } from "@/types/purchaseHistory";

const purchaseHistoryRepository =
  createLocalStorageRepository<PurchaseHistoryItem>(STORAGE_KEYS.purchaseHistory);

export function getPurchaseHistories(): PurchaseHistoryItem[] {
  return purchaseHistoryRepository.list();
}

export function savePurchaseHistory(item: PurchaseHistoryItem) {
  purchaseHistoryRepository.create(item);
}

export function updatePurchaseHistory(item: PurchaseHistoryItem) {
  purchaseHistoryRepository.update(item);
}

export function deletePurchaseHistory(id: string) {
  purchaseHistoryRepository.delete(id);
}

export { normalizePurchaseName };

export function findMatchingPurchaseHistory(
  productName: string,
  histories = getPurchaseHistories()
) {
  const targetName = normalizePurchaseName(productName);

  if (!targetName) return null;

  return (
    histories.find((history) => {
      const savedName = normalizePurchaseName(history.productName);

      return (
        savedName === targetName ||
        savedName.includes(targetName) ||
        targetName.includes(savedName)
      );
    }) ?? null
  );
}

export function createId() {
  if (isBrowser() && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
