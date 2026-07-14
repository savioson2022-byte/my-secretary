"use client";

import { useEffect } from "react";
import { getCloudDataSyncedEventName } from "@/lib/dataSyncEvents";
import {
  getPurchaseHistories,
  savePurchaseHistory,
  updatePurchaseHistory,
} from "@/lib/purchaseHistoryStorage";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PurchaseHistoryItem } from "@/types/purchaseHistory";

const AUTO_SYNC_STORAGE_KEY = "my-assistant-purchase-mail-auto-sync-at";
const INITIAL_MAIL_IMPORT_PENDING_KEY =
  "my-assistant-purchase-mail-initial-import-pending";
const AUTO_SYNC_INTERVAL_MS = 1000 * 60 * 60 * 6;
const AUTO_SYNC_TIMER_MS = 1000 * 60 * 15;

function getAutoSyncStorageKey(userId: string) {
  return `${AUTO_SYNC_STORAGE_KEY}:${userId}`;
}

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
    let isSyncing = false;

    async function syncPurchaseMailQuietly() {
      if (isSyncing) return;
      if (new URLSearchParams(window.location.search).has("mail_connected")) {
        return;
      }
      if (window.sessionStorage.getItem(INITIAL_MAIL_IMPORT_PENDING_KEY)) {
        return;
      }

      const supabase = createSupabaseBrowserClient();

      if (!supabase) return;

      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const userId = data.session?.user.id;

      if (!accessToken || !userId || isCancelled) return;

      const storageKey = getAutoSyncStorageKey(userId);
      const lastSyncedAt = Number(
        window.localStorage.getItem(storageKey) ?? 0
      );

      if (Date.now() - lastSyncedAt < AUTO_SYNC_INTERVAL_MS) {
        return;
      }

      isSyncing = true;

      try {
        const response = await fetch("/api/purchase/mail/sync", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok || isCancelled) {
          return;
        }

        const result = (await response.json()) as {
          importedHistories?: PurchaseHistoryItem[];
        };

        (result.importedHistories ?? []).forEach(upsertLocalPurchaseHistory);
        window.localStorage.setItem(storageKey, String(Date.now()));

        if ((result.importedHistories ?? []).length > 0) {
          window.dispatchEvent(
            new CustomEvent(getCloudDataSyncedEventName(), {
              detail: {
                source: "purchase-mail-auto-sync",
                importedCount: result.importedHistories?.length ?? 0,
              },
            })
          );
        }
      } catch {
        window.localStorage.removeItem(storageKey);
      } finally {
        isSyncing = false;
      }
    }

    function syncWhenVisible() {
      if (document.visibilityState === "visible") {
        void syncPurchaseMailQuietly();
      }
    }

    syncPurchaseMailQuietly();
    const intervalId = window.setInterval(() => {
      void syncPurchaseMailQuietly();
    }, AUTO_SYNC_TIMER_MS);

    document.addEventListener("visibilitychange", syncWhenVisible);
    window.addEventListener("focus", syncWhenVisible);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", syncWhenVisible);
      window.removeEventListener("focus", syncWhenVisible);
    };
  }, []);

  return null;
}
