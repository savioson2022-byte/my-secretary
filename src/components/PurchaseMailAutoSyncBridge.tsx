"use client";

import { useEffect } from "react";
import {
  getPurchaseHistories,
  savePurchaseHistory,
  updatePurchaseHistory,
} from "@/lib/purchaseHistoryStorage";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PurchaseHistoryItem } from "@/types/purchaseHistory";

const AUTO_SYNC_STORAGE_KEY = "my-assistant-purchase-mail-auto-sync-at";
const AUTO_SYNC_INTERVAL_MS = 1000 * 60 * 60 * 6;

function upsertLocalPurchaseHistory(history: PurchaseHistoryItem) {
  const histories = getPurchaseHistories();
  const existingHistory = histories.find((item) => item.id === history.id);

  if (existingHistory) {
    updatePurchaseHistory(history);
    return;
  }

  const sameSourceHistory = histories.find((item) => {
    return (
      history.sourceMessageId &&
      item.sourceMessageId === history.sourceMessageId &&
      item.productName === history.productName
    );
  });

  if (sameSourceHistory) {
    updatePurchaseHistory({
      ...sameSourceHistory,
      ...history,
      id: sameSourceHistory.id,
      updatedAt: history.updatedAt,
    });
    return;
  }

  savePurchaseHistory(history);
}

export default function PurchaseMailAutoSyncBridge() {
  useEffect(() => {
    let isCancelled = false;

    async function syncPurchaseMailQuietly() {
      const lastSyncedAt = Number(
        window.localStorage.getItem(AUTO_SYNC_STORAGE_KEY) ?? 0
      );

      if (Date.now() - lastSyncedAt < AUTO_SYNC_INTERVAL_MS) {
        return;
      }

      const supabase = createSupabaseBrowserClient();

      if (!supabase) return;

      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken || isCancelled) return;

      window.localStorage.setItem(AUTO_SYNC_STORAGE_KEY, String(Date.now()));

      try {
        const response = await fetch("/api/purchase/mail/sync", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok || isCancelled) return;

        const result = (await response.json()) as {
          importedHistories?: PurchaseHistoryItem[];
        };

        (result.importedHistories ?? []).forEach(upsertLocalPurchaseHistory);
      } catch {
        window.localStorage.removeItem(AUTO_SYNC_STORAGE_KEY);
      }
    }

    syncPurchaseMailQuietly();

    return () => {
      isCancelled = true;
    };
  }, []);

  return null;
}
