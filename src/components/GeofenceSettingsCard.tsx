"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getGeofenceStatus,
  requestGeofenceAccess,
  syncGeofenceRegions,
  type GeofenceStatus,
} from "@/lib/geofence";
import { getSavedPlaces } from "@/lib/placeStorage";
import { CONTEXT_EVENT_LABEL } from "@/types/contextEvent";
import {
  CONTEXT_EVENT_CHANGED_EVENT,
  getContextEvents,
} from "@/lib/contextEventStorage";
import type { ContextEvent } from "@/types/contextEvent";

const UNAVAILABLE_STATUS: GeofenceStatus = {
  available: false,
  authorizationState: "denied",
  monitoredCount: 0,
  maxRegions: 0,
};

function formatTime(isoText: string) {
  const date = new Date(isoText);

  return `${date.getMonth() + 1}/${date.getDate()} ${String(
    date.getHours()
  ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export default function GeofenceSettingsCard() {
  const [status, setStatus] = useState<GeofenceStatus>(UNAVAILABLE_STATUS);
  const [events, setEvents] = useState<ContextEvent[]>([]);
  const [placeCount, setPlaceCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);

  const refresh = useCallback(async () => {
    setStatus(await getGeofenceStatus());
    setEvents(getContextEvents().slice(0, 5));
    setPlaceCount(
      getSavedPlaces().filter(
        (place) =>
          typeof place.latitude === "number" &&
          typeof place.longitude === "number"
      ).length
    );
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void refresh();

    const handleChanged = () => void refresh();
    window.addEventListener(CONTEXT_EVENT_CHANGED_EVENT, handleChanged);

    return () => {
      window.removeEventListener(CONTEXT_EVENT_CHANGED_EVENT, handleChanged);
    };
  }, [refresh]);

  async function enable() {
    setIsRequesting(true);
    try {
      const nextStatus = await requestGeofenceAccess();
      setStatus(nextStatus);

      if (nextStatus.authorizationState === "always") {
        await syncGeofenceRegions();
      }

      await refresh();
    } finally {
      setIsRequesting(false);
    }
  }

  if (isLoading) {
    return (
      <section className="app-card p-5">
        <p className="text-sm font-bold text-slate-400">불러오는 중...</p>
      </section>
    );
  }

  if (!status.available) {
    return (
      <section className="app-card p-5">
        <h2 className="font-black text-slate-900">장소 감지</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
          장소 감지는 현재 iPhone 앱에서만 지원합니다.
        </p>
      </section>
    );
  }

  const isOn = status.authorizationState === "always";

  return (
    <div className="space-y-4">
      <section className="app-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-black text-slate-900">장소 감지</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
              저장한 장소에 도착하면 앱이 알아채고, 거기서 할 수 있는 일을 먼저
              꺼내줍니다. 30분마다 위치를 확인하던 방식보다 배터리를 훨씬 덜
              씁니다.
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black ${
              isOn
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {isOn ? "켜짐" : "꺼짐"}
          </span>
        </div>

        {status.authorizationState === "denied" ||
        status.authorizationState === "restricted" ? (
          <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-700 ring-1 ring-amber-100">
            iPhone 설정 → 개인정보 보호 및 보안 → 위치 서비스 → 나의 비서에서
            <b> 항상</b>을 선택해주세요. 앱이 닫혀 있을 때도 도착을 알아채려면
            &apos;항상&apos;이 필요합니다.
          </p>
        ) : isOn ? (
          <p className="mt-4 text-xs font-bold leading-5 text-slate-400">
            좌표가 있는 저장 장소 {placeCount}곳 중 {status.monitoredCount}곳을
            감시하고 있습니다. iOS는 한 앱에 최대 {status.maxRegions}곳까지
            허용합니다.
          </p>
        ) : (
          <button
            type="button"
            disabled={isRequesting}
            onClick={() => void enable()}
            className="mt-4 min-h-11 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {isRequesting ? "권한 확인 중..." : "장소 감지 켜기"}
          </button>
        )}

        {placeCount === 0 && (
          <p className="mt-3 text-xs font-bold leading-5 text-slate-400">
            좌표가 있는 저장 장소가 아직 없습니다. 설정 → 장소와 이동에서 장소를
            검색해 추가하면 감지 대상이 됩니다.
          </p>
        )}
      </section>

      <section className="app-card p-5">
        <h3 className="font-black text-slate-900">최근 감지</h3>
        <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">
          앱이 관찰한 사실입니다. 48시간이 지나면 지워집니다.
        </p>

        {events.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-xs font-bold leading-5 text-slate-500">
            아직 감지된 것이 없습니다.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-black text-slate-900">
                  {event.placeName ?? "이름 없는 장소"}
                </span>
                <span className="shrink-0 text-[11px] font-bold text-slate-400">
                  {CONTEXT_EVENT_LABEL[event.type]} · {formatTime(event.occurredAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
