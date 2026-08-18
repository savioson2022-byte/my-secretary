"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getExternalCalendarStatus,
  listExternalCalendarSources,
  requestExternalCalendarAccess,
} from "@/lib/externalCalendar";
import {
  DEFAULT_EXTERNAL_CALENDAR_SETTINGS,
  getExternalCalendarSettings,
  isCalendarSourceEnabled,
  saveExternalCalendarSettings,
  toggleCalendarSource,
  type ExternalCalendarSettings,
} from "@/lib/externalCalendarSettings";
import { UNAVAILABLE_EXTERNAL_CALENDAR_STATUS } from "@/types/externalCalendar";
import type {
  ExternalCalendarSource,
  ExternalCalendarStatus,
} from "@/types/externalCalendar";

function getUnavailableMessage(status: ExternalCalendarStatus) {
  if (status.reason === "appUpdateRequired") {
    return "앱을 최신 버전으로 업데이트하면 캘린더를 연동할 수 있습니다.";
  }

  if (status.reason === "bridgeError") {
    return "캘린더에 연결하지 못했습니다. 앱을 다시 시작한 뒤 시도해주세요.";
  }

  return "캘린더 연동은 현재 iPhone 앱에서만 지원합니다.";
}

export default function ExternalCalendarSettingsCard() {
  const [status, setStatus] = useState<ExternalCalendarStatus>(
    UNAVAILABLE_EXTERNAL_CALENDAR_STATUS
  );
  const [sources, setSources] = useState<ExternalCalendarSource[]>([]);
  const [settings, setSettings] = useState<ExternalCalendarSettings>(
    DEFAULT_EXTERNAL_CALENDAR_SETTINGS
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);

  const refresh = useCallback(async () => {
    const nextStatus = await getExternalCalendarStatus();
    setStatus(nextStatus);
    setSettings(getExternalCalendarSettings());

    if (nextStatus.authorizationState === "fullAccess") {
      setSources(await listExternalCalendarSources());
    } else {
      setSources([]);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function enableIntegration() {
    setIsRequesting(true);
    try {
      const nextStatus = await requestExternalCalendarAccess();
      setStatus(nextStatus);

      if (nextStatus.authorizationState === "fullAccess") {
        setSettings(
          saveExternalCalendarSettings({
            enabled: true,
            includedCalendarIds: settings.includedCalendarIds,
            excludedCalendarIds: settings.excludedCalendarIds,
          })
        );
        setSources(await listExternalCalendarSources());
      }
    } finally {
      setIsRequesting(false);
    }
  }

  function disableIntegration() {
    setSettings(
      saveExternalCalendarSettings({
        enabled: false,
        includedCalendarIds: settings.includedCalendarIds,
        excludedCalendarIds: settings.excludedCalendarIds,
      })
    );
  }

  function toggleSource(source: ExternalCalendarSource, nextEnabled: boolean) {
    setSettings(
      saveExternalCalendarSettings(
        toggleCalendarSource(settings, source, nextEnabled)
      )
    );
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
        <h2 className="font-black text-slate-900">캘린더 연동</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
          {getUnavailableMessage(status)}
        </p>
      </section>
    );
  }

  const isDenied =
    status.authorizationState === "denied" ||
    status.authorizationState === "restricted";
  const isConnected =
    status.authorizationState === "fullAccess" && settings.enabled;

  return (
    <div className="space-y-4">
      <section className="app-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-black text-slate-900">캘린더 연동</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
              iPhone 캘린더에 이미 잡혀 있는 일정을 읽어, 진짜 비어 있는 시간만
              추천합니다. 일정을 앱에 다시 입력하지 않아도 됩니다.
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black ${
              isConnected
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {isConnected ? "연결됨" : "꺼짐"}
          </span>
        </div>

        {isDenied ? (
          <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-700 ring-1 ring-amber-100">
            iPhone 설정 → 개인정보 보호 및 보안 → 캘린더에서 나의 비서의 접근을
            허용해주세요. 읽기 권한이 없으면 빈 시간을 정확히 계산할 수 없습니다.
          </p>
        ) : isConnected ? (
          <button
            type="button"
            onClick={disableIntegration}
            className="mt-4 min-h-11 w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200"
          >
            연동 끄기
          </button>
        ) : (
          <button
            type="button"
            disabled={isRequesting}
            onClick={() => void enableIntegration()}
            className="mt-4 min-h-11 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {isRequesting ? "권한 확인 중..." : "캘린더 연동 켜기"}
          </button>
        )}

        <p className="mt-3 text-xs font-semibold leading-5 text-slate-400">
          읽기만 합니다. 이 앱은 자기가 만들지 않은 일정을 수정하거나 삭제하지
          않습니다.
        </p>
      </section>

      {isConnected && sources.length > 0 && (
        <section className="app-card p-5">
          <h3 className="font-black text-slate-900">읽을 캘린더</h3>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">
            공휴일이나 구독한 캘린더는 기본으로 꺼져 있습니다. 바쁜 시간으로
            계산할 캘린더만 켜주세요.
          </p>

          <div className="mt-4 space-y-2">
            {sources.map((source) => {
              const enabled = isCalendarSourceEnabled(source, settings);

              return (
                <label
                  key={source.id}
                  className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100"
                >
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 rounded-full ring-1 ring-slate-200"
                    style={{ backgroundColor: source.colorHex ?? "#94A3B8" }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-slate-900">
                      {source.title}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] font-bold text-slate-400">
                      {source.sourceName}
                      {source.isSubscribed ? " · 구독" : ""}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) =>
                      toggleSource(source, event.target.checked)
                    }
                    className="h-5 w-5 shrink-0 accent-blue-600"
                  />
                </label>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
