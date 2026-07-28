"use client";

import { useEffect, useState } from "react";
import { getLocalDataUpdatedEventName } from "@/lib/localStorageRepository";
import { getSavedPlaces } from "@/lib/placeStorage";
import { saveTravelModeFeedback } from "@/lib/personalAiMemoryStorage";
import {
  deleteTravelTimeRule,
  getTravelTimeRules,
  saveTravelModePreference,
  TRAVEL_MODE_PREFERENCE_MEMO,
} from "@/lib/travelTimeStorage";
import type { TravelMode, TravelTimeRule } from "@/types/calendar";

const MODE_OPTIONS: Array<{ value: TravelMode; label: string }> = [
  { value: "walk", label: "도보" },
  { value: "car", label: "자차" },
  { value: "transit", label: "대중교통" },
];

function getModeLabel(mode: TravelMode) {
  return MODE_OPTIONS.find((option) => option.value === mode)?.label ?? mode;
}

function getEligiblePlaces() {
  return getSavedPlaces().filter(
    (place) =>
      Number.isFinite(place.latitude) && Number.isFinite(place.longitude)
  );
}

export default function TravelModeLearningCard() {
  const [places, setPlaces] = useState(getEligiblePlaces);
  const [fromPlaceName, setFromPlaceName] = useState("");
  const [toPlaceName, setToPlaceName] = useState("");
  const [mode, setMode] = useState<TravelMode>("walk");
  const [rules, setRules] = useState<TravelTimeRule[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  function refreshRules() {
    setRules(
      getTravelTimeRules()
        .filter((rule) => rule.memo.includes(TRAVEL_MODE_PREFERENCE_MEMO))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    );
  }

  useEffect(() => {
    const refresh = () => {
      setPlaces(getEligiblePlaces());
      refreshRules();
    };
    refresh();
    window.addEventListener(getLocalDataUpdatedEventName(), refresh);

    return () => {
      window.removeEventListener(getLocalDataUpdatedEventName(), refresh);
    };
  }, []);

  function savePreference() {
    if (!fromPlaceName || !toPlaceName) {
      setMessage("출발 장소와 도착 장소를 모두 선택해 주세요.");
      return;
    }
    if (fromPlaceName === toPlaceName) {
      setMessage("서로 다른 장소를 선택해 주세요.");
      return;
    }

    saveTravelModePreference({ fromPlaceName, toPlaceName, mode });
    saveTravelModeFeedback({
      fromPlaceName,
      toPlaceName,
      modeLabel: getModeLabel(mode),
    });
    refreshRules();
    window.dispatchEvent(
      new Event("my-assistant-notification-settings-updated")
    );
    setMessage(
      `${fromPlaceName} → ${toPlaceName} 경로는 ${getModeLabel(mode)}로 학습했어요.`
    );
  }

  function removePreference(rule: TravelTimeRule) {
    deleteTravelTimeRule(rule.id);
    refreshRules();
    window.dispatchEvent(
      new Event("my-assistant-notification-settings-updated")
    );
    setMessage("경로별 이동수단 학습을 삭제했어요.");
  }

  function changePreferenceMode(rule: TravelTimeRule, nextMode: TravelMode) {
    saveTravelModePreference({
      fromPlaceName: rule.fromPlaceName,
      toPlaceName: rule.toPlaceName,
      mode: nextMode,
    });
    saveTravelModeFeedback({
      fromPlaceName: rule.fromPlaceName,
      toPlaceName: rule.toPlaceName,
      modeLabel: getModeLabel(nextMode),
    });
    refreshRules();
    window.dispatchEvent(
      new Event("my-assistant-notification-settings-updated")
    );
    setMessage(
      `${rule.fromPlaceName} → ${rule.toPlaceName} 경로를 ${getModeLabel(nextMode)}로 다시 학습했어요.`
    );
  }

  return (
    <div className="mt-4 rounded-3xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
      <div>
        <p className="text-xs font-black text-emerald-700">Gemma 이동 학습</p>
        <h3 className="mt-1 text-base font-black text-slate-900">
          장소별 이동수단 교정
        </h3>
        <p className="mt-2 text-xs font-bold leading-5 text-slate-600">
          기본 이동수단과 다른 경로를 직접 저장하면 다음 알람부터 우선
          적용하고 Gemma 4의 일정·알림 기준에도 학습합니다. 학습 사례가 없는
          1.2km 이하 경로는 일반적으로 도보를 먼저 가정합니다.
        </p>
      </div>

      {places.length >= 2 ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-black text-slate-500">
              출발 장소
              <select
                value={fromPlaceName}
                onChange={(event) => setFromPlaceName(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
              >
                <option value="">선택</option>
                {places.map((place) => (
                  <option key={place.id} value={place.name}>
                    {place.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-black text-slate-500">
              도착 장소
              <select
                value={toPlaceName}
                onChange={(event) => setToPlaceName(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400"
              >
                <option value="">선택</option>
                {places.map((place) => (
                  <option key={place.id} value={place.name}>
                    {place.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {MODE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMode(option.value)}
                className={`rounded-2xl px-3 py-3 text-sm font-black ${
                  mode === option.value
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-slate-600 ring-1 ring-emerald-100"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={savePreference}
            className="mt-3 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white"
          >
            이 경로 학습하기
          </button>
        </>
      ) : (
        <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-xs font-bold leading-5 text-slate-500">
          장소 설정에 좌표가 있는 장소를 2개 이상 등록하면 경로별 이동수단을
          학습할 수 있습니다.
        </p>
      )}

      {rules.length > 0 && (
        <div className="mt-4 space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 ring-1 ring-emerald-100"
            >
              <div>
                <p className="text-sm font-black text-slate-900">
                  {rule.fromPlaceName} → {rule.toPlaceName}
                </p>
                <p className="mt-1 text-xs font-bold text-emerald-700">
                  {getModeLabel(rule.mode)} 우선
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-1.5">
                {MODE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => changePreferenceMode(rule, option.value)}
                    className={`rounded-full px-2.5 py-1.5 text-xs font-black ${
                      rule.mode === option.value
                        ? "bg-emerald-600 text-white"
                        : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => removePreference(rule)}
                  className="rounded-full bg-slate-100 px-2.5 py-1.5 text-xs font-black text-slate-500"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {message && (
        <p className="mt-3 text-xs font-black leading-5 text-emerald-700">
          {message}
        </p>
      )}
    </div>
  );
}
