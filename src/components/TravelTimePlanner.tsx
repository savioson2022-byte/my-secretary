"use client";

import { useMemo, useState } from "react";
import {
  deleteSavedPlace,
  saveSavedPlace,
} from "@/lib/placeStorage";
import {
  deleteTravelTimeRule,
  saveTravelTimeRule,
} from "@/lib/travelTimeStorage";
import { calculateWeeklyTravelTransitions } from "@/lib/travelTime";
import {
  SavedPlace,
  SingleSchedule,
  TravelMode,
  TravelTimeRule,
} from "@/types/calendar";
import { RoutineSchedule } from "@/types/routine";

type TravelTimePlannerProps = {
  routines: RoutineSchedule[];
  singleSchedules: SingleSchedule[];
  savedPlaces: SavedPlace[];
  travelTimeRules: TravelTimeRule[];
  onChange: () => void;
};

const TRAVEL_MODES: Array<{
  value: TravelMode;
  label: string;
}> = [
  {
    value: "car",
    label: "자차",
  },
  {
    value: "transit",
    label: "대중교통",
  },
  {
    value: "walk",
    label: "도보",
  },
  {
    value: "bike",
    label: "자전거",
  },
];

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatMinutes(minutes: number) {
  const safeMinutes = Math.max(0, minutes);
  const hours = Math.floor(safeMinutes / 60);
  const remainMinutes = safeMinutes % 60;

  if (hours === 0) {
    return `${remainMinutes}분`;
  }

  if (remainMinutes === 0) {
    return `${hours}시간`;
  }

  return `${hours}시간 ${remainMinutes}분`;
}

function getStatusStyle(status: string) {
  if (status === "enough" || status === "same-place") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  }

  if (status === "tight") {
    return "bg-amber-50 text-amber-700 ring-amber-100";
  }

  if (status === "not-enough") {
    return "bg-red-50 text-red-700 ring-red-100";
  }

  return "bg-slate-50 text-slate-500 ring-slate-100";
}

function getStatusLabel(status: string) {
  if (status === "same-place") return "같은 장소";
  if (status === "enough") return "이동 가능";
  if (status === "tight") return "빠듯함";
  if (status === "not-enough") return "이동 어려움";
  return "규칙 필요";
}

function getModeLabel(mode: TravelMode) {
  return TRAVEL_MODES.find((item) => item.value === mode)?.label ?? mode;
}

export default function TravelTimePlanner({
  routines,
  singleSchedules,
  savedPlaces,
  travelTimeRules,
  onChange,
}: TravelTimePlannerProps) {
  const [placeName, setPlaceName] = useState("");
  const [placeAddress, setPlaceAddress] = useState("");
  const [placeMemo, setPlaceMemo] = useState("");

  const [fromPlaceName, setFromPlaceName] = useState("");
  const [toPlaceName, setToPlaceName] = useState("");
  const [mode, setMode] = useState<TravelMode>("transit");
  const [minutes, setMinutes] = useState("30");
  const [ruleMemo, setRuleMemo] = useState("");
  const [selectedMode, setSelectedMode] = useState<TravelMode>("transit");

  const placeNameOptions = useMemo(() => {
    const names = new Set<string>();

    savedPlaces.forEach((place) => {
      if (place.name.trim()) {
        names.add(place.name.trim());
      }
    });

    routines.forEach((routine) => {
      if (routine.placeName.trim()) {
        names.add(routine.placeName.trim());
      }
    });

    singleSchedules.forEach((schedule) => {
      if (schedule.placeName.trim()) {
        names.add(schedule.placeName.trim());
      }
    });

    return Array.from(names).sort((a, b) => a.localeCompare(b, "ko"));
  }, [routines, savedPlaces, singleSchedules]);

  const transitions = useMemo(() => {
    return calculateWeeklyTravelTransitions({
      routines,
      singleSchedules,
      travelTimeRules,
      mode: selectedMode,
    });
  }, [routines, selectedMode, singleSchedules, travelTimeRules]);

  function handleSavePlace() {
    if (!placeName.trim()) {
      alert("장소 이름을 입력해줘.");
      return;
    }

    const now = new Date().toISOString();

    saveSavedPlace({
      id: createId(),
      name: placeName.trim(),
      address: placeAddress.trim(),
      memo: placeMemo.trim(),
      createdAt: now,
      updatedAt: now,
    });

    setPlaceName("");
    setPlaceAddress("");
    setPlaceMemo("");
    onChange();
  }

  function handleSaveTravelRule() {
    const parsedMinutes = Number(minutes);

    if (!fromPlaceName.trim() || !toPlaceName.trim()) {
      alert("출발 장소와 도착 장소를 입력해줘.");
      return;
    }

    if (fromPlaceName.trim() === toPlaceName.trim()) {
      alert("서로 다른 장소를 선택해줘.");
      return;
    }

    if (!Number.isFinite(parsedMinutes) || parsedMinutes <= 0) {
      alert("이동 시간을 1분 이상으로 입력해줘.");
      return;
    }

    const now = new Date().toISOString();

    saveTravelTimeRule({
      id: createId(),
      fromPlaceName: fromPlaceName.trim(),
      toPlaceName: toPlaceName.trim(),
      mode,
      minutes: Math.round(parsedMinutes),
      memo: ruleMemo.trim(),
      createdAt: now,
      updatedAt: now,
    });

    setMinutes("30");
    setRuleMemo("");
    onChange();
  }

  return (
    <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
      <div>
        <h2 className="text-lg font-black text-slate-900">
          장소와 이동시간
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          장소를 저장하고 장소 사이 이동시간을 수단별로 입력하면, 이번 주
          일정 사이에 이동이 가능한지 계산합니다.
        </p>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <section className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-100">
          <h3 className="text-sm font-black text-slate-800">장소 저장</h3>

          <div className="mt-3 space-y-3">
            <input
              value={placeName}
              onChange={(event) => setPlaceName(event.target.value)}
              placeholder="장소 이름: 집, 학교, 영어학원"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400"
            />
            <input
              value={placeAddress}
              onChange={(event) => setPlaceAddress(event.target.value)}
              placeholder="주소 또는 설명"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400"
            />
            <input
              value={placeMemo}
              onChange={(event) => setPlaceMemo(event.target.value)}
              placeholder="메모"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400"
            />
            <button
              type="button"
              onClick={handleSavePlace}
              className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-700"
            >
              장소 저장
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {savedPlaces.length === 0 ? (
              <p className="rounded-2xl bg-white p-3 text-sm text-slate-500">
                아직 저장된 장소가 없습니다.
              </p>
            ) : (
              savedPlaces.map((place) => (
                <div
                  key={place.id}
                  className="flex items-start justify-between gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-100"
                >
                  <div>
                    <p className="text-sm font-black text-slate-900">
                      {place.name}
                    </p>
                    {place.address && (
                      <p className="mt-1 text-xs text-slate-500">
                        {place.address}
                      </p>
                    )}
                    {place.memo && (
                      <p className="mt-1 text-xs text-slate-400">
                        {place.memo}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      deleteSavedPlace(place.id);
                      onChange();
                    }}
                    className="shrink-0 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-100"
                  >
                    삭제
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-100">
          <h3 className="text-sm font-black text-slate-800">
            이동시간 규칙
          </h3>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <input
              list="travel-place-options"
              value={fromPlaceName}
              onChange={(event) => setFromPlaceName(event.target.value)}
              placeholder="출발 장소"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400"
            />
            <input
              list="travel-place-options"
              value={toPlaceName}
              onChange={(event) => setToPlaceName(event.target.value)}
              placeholder="도착 장소"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400"
            />
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as TravelMode)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400"
            >
              {TRAVEL_MODES.map((travelMode) => (
                <option key={travelMode.value} value={travelMode.value}>
                  {travelMode.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
              placeholder="분"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400"
            />
          </div>

          <input
            value={ruleMemo}
            onChange={(event) => setRuleMemo(event.target.value)}
            placeholder="예: 평일 오후 기준, 버스 환승 포함"
            className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400"
          />

          <button
            type="button"
            onClick={handleSaveTravelRule}
            className="mt-3 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-500"
          >
            이동시간 저장
          </button>

          <datalist id="travel-place-options">
            {placeNameOptions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>

          <div className="mt-4 space-y-2">
            {travelTimeRules.length === 0 ? (
              <p className="rounded-2xl bg-white p-3 text-sm text-slate-500">
                아직 이동시간 규칙이 없습니다.
              </p>
            ) : (
              travelTimeRules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-start justify-between gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-100"
                >
                  <div>
                    <p className="text-sm font-black text-slate-900">
                      {rule.fromPlaceName} → {rule.toPlaceName}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {getModeLabel(rule.mode)} · {formatMinutes(rule.minutes)}
                    </p>
                    {rule.memo && (
                      <p className="mt-1 text-xs text-slate-400">
                        {rule.memo}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      deleteTravelTimeRule(rule.id);
                      onChange();
                    }}
                    className="shrink-0 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-100"
                  >
                    삭제
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-100">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-800">
              이번 주 이동 가능성
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              일정 종료 시간과 다음 일정 시작 시간 사이의 여유를 계산합니다.
            </p>
          </div>

          <select
            value={selectedMode}
            onChange={(event) =>
              setSelectedMode(event.target.value as TravelMode)
            }
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-blue-400"
          >
            {TRAVEL_MODES.map((travelMode) => (
              <option key={travelMode.value} value={travelMode.value}>
                {travelMode.label} 기준
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 space-y-2">
          {transitions.length === 0 ? (
            <p className="rounded-2xl bg-white p-3 text-sm text-slate-500">
              이번 주에 이어지는 일정이 아직 없습니다.
            </p>
          ) : (
            transitions.map((transition) => (
              <article
                key={`${transition.date}-${transition.fromTitle}-${transition.toTitle}-${transition.previousEndTime}`}
                className="rounded-2xl bg-white p-4 ring-1 ring-slate-100"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-black text-slate-900">
                      {transition.date} · {transition.fromTitle} →{" "}
                      {transition.toTitle}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {transition.fromPlaceName} → {transition.toPlaceName}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${getStatusStyle(
                      transition.status
                    )}`}
                  >
                    {getStatusLabel(transition.status)}
                  </span>
                </div>

                <p className="mt-3 text-sm leading-6 text-slate-600">
                  이전 일정 종료 {transition.previousEndTime}, 다음 일정 시작{" "}
                  {transition.nextStartTime}. 여유 시간은{" "}
                  <span className="font-black">
                    {formatMinutes(transition.gapMinutes)}
                  </span>
                  입니다.
                  {transition.requiredMinutes === null
                    ? " 이 경로의 이동시간 규칙을 추가하면 판단할 수 있습니다."
                    : ` ${getModeLabel(transition.mode)} 이동시간은 ${formatMinutes(
                        transition.requiredMinutes
                      )}입니다.`}
                </p>
              </article>
            ))
          )}
        </div>
      </section>

      <p className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm leading-6 text-blue-700 ring-1 ring-blue-100">
        현재 이동시간은 사용자가 저장한 규칙으로 계산합니다. 카카오맵 같은
        실시간 길찾기 API는 나중에 키와 정책을 확인한 뒤 이 규칙 계산 부분에
        연결할 수 있습니다.
      </p>
    </section>
  );
}
