"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getLocalDataUpdatedEventName } from "@/lib/localStorageRepository";
import { syncLocalDataWithCloud } from "@/lib/cloudDataSync";
import {
  CLOUD_DATA_SYNCED_EVENT,
  saveCloudSyncStatus,
} from "@/lib/dataSyncEvents";

export default function CloudDataSyncBridge() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const isSyncingRef = useRef(false);
  const pendingSyncTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!supabase) return;

    const client = supabase;
    let isMounted = true;

    async function loadSession() {
      const { data } = await client.auth.getSession();

      if (!isMounted) return;

      setUserId(data.session?.user.id ?? null);
    }

    loadSession();

    const { data: listener } = client.auth.onAuthStateChange(
      (_event, session) => {
        setUserId(session?.user.id ?? null);
      }
    );

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !userId) return;

    const client = supabase;
    const activeUserId = userId;

    async function runSync() {
      if (isSyncingRef.current) return;

      isSyncingRef.current = true;

      try {
        const results = await syncLocalDataWithCloud({
          supabase: client,
          userId: activeUserId,
        });
        const failedResults = results.filter((result) => !result.ok);
        const status = failedResults.length === 0 ? "success" : "partial";

        saveCloudSyncStatus({
          status,
          updatedAt: new Date().toISOString(),
          results,
        });

        window.dispatchEvent(
          new CustomEvent(CLOUD_DATA_SYNCED_EVENT, {
            detail: {
              source: "cloud-sync",
              status,
              results,
            },
          })
        );
      } catch (error) {
        console.error("클라우드 데이터 동기화 실패:", error);
        saveCloudSyncStatus({
          status: "failed",
          updatedAt: new Date().toISOString(),
          results: [
            {
              table: "all",
              ok: false,
              message:
                error instanceof Error
                  ? error.message
                  : "알 수 없는 동기화 오류",
            },
          ],
        });
      } finally {
        isSyncingRef.current = false;
      }
    }

    function scheduleSync(event?: Event) {
      const customEvent = event as CustomEvent<{ source?: string }>;

      if (customEvent.detail?.source === "cloud-sync") {
        return;
      }

      if (pendingSyncTimerRef.current) {
        window.clearTimeout(pendingSyncTimerRef.current);
      }

      pendingSyncTimerRef.current = window.setTimeout(() => {
        runSync();
      }, 500);
    }

    runSync();

    window.addEventListener(getLocalDataUpdatedEventName(), scheduleSync);

    return () => {
      window.removeEventListener(getLocalDataUpdatedEventName(), scheduleSync);

      if (pendingSyncTimerRef.current) {
        window.clearTimeout(pendingSyncTimerRef.current);
      }
    };
  }, [supabase, userId]);

  return null;
}
