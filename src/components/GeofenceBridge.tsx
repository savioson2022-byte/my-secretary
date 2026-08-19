"use client";

import { useEffect } from "react";
import {
  getGeofenceStatus,
  listenToGeofenceEvents,
  syncGeofenceRegions,
} from "@/lib/geofence";
import { getLocalDataUpdatedEventName } from "@/lib/localStorageRepository";

/**
 * 저장 장소가 바뀌면 감시 영역을 다시 올리고, 도착·이탈을 맥락 기록으로 남긴다.
 *
 * 권한을 먼저 묻지 않는다. 사용자가 설정에서 켠 뒤에만 동작한다.
 */
export default function GeofenceBridge() {
  useEffect(() => {
    let removeListener = () => {};
    let cancelled = false;

    async function start() {
      const status = await getGeofenceStatus();

      if (cancelled || !status.available) return;
      if (status.authorizationState !== "always") return;

      await syncGeofenceRegions();

      if (cancelled) return;

      removeListener = listenToGeofenceEvents();
    }

    void start();

    // 장소를 추가하거나 지우면 감시 영역도 따라가야 한다.
    const handleLocalDataUpdated = () => void syncGeofenceRegions();
    window.addEventListener(
      getLocalDataUpdatedEventName(),
      handleLocalDataUpdated
    );

    return () => {
      cancelled = true;
      removeListener();
      window.removeEventListener(
        getLocalDataUpdatedEventName(),
        handleLocalDataUpdated
      );
    };
  }, []);

  return null;
}
