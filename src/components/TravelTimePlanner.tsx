"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PostcodeAddressSearch from "@/components/PostcodeAddressSearch";
import {
  deleteSavedPlace,
  saveSavedPlace,
  updateSavedPlace,
} from "@/lib/placeStorage";
import {
  calculateWeeklyTravelTransitions,
  createTravelTimeCacheKey,
} from "@/lib/travelTime";
import {
  getTravelTimeEstimates,
  saveTravelTimeEstimate,
} from "@/lib/travelTimeStorage";
import { getUserProfile } from "@/lib/userProfileStorage";
import {
  SavedPlace,
  SingleSchedule,
  TravelTimeEstimate,
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
  hint: string;
}> = [
  {
    value: "walk",
    label: "도보",
    hint: "짧은 거리",
  },
  {
    value: "transit",
    label: "대중교통",
    hint: "버스/지하철",
  },
  {
    value: "car",
    label: "자차",
    hint: "운전/주차",
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

  return "bg-blue-50 text-blue-700 ring-blue-100";
}

function getStatusLabel(status: string) {
  if (status === "enough") return "이동 가능";
  if (status === "tight") return "빠듯함";
  if (status === "not-enough") return "이동 어려움";
  return "자동 계산 대기";
}

function getModeLabel(mode: TravelMode) {
  return TRAVEL_MODES.find((item) => item.value === mode)?.label ?? mode;
}

function getDefaultTravelMode(): TravelMode {
  if (typeof window === "undefined") return "transit";

  return getUserProfile()?.preferredTravelMode ?? "transit";
}

function getPlaceByName(places: SavedPlace[], placeName: string) {
  const normalizedPlaceName = placeName.trim().toLowerCase();

  return places.find((place) => {
    return place.name.trim().toLowerCase() === normalizedPlaceName;
  });
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
  const [postalCode, setPostalCode] = useState("");
  const [placeMemo, setPlaceMemo] = useState("");
  const [selectedMode, setSelectedMode] =
    useState<TravelMode>(getDefaultTravelMode);
  const [travelTimeEstimates, setTravelTimeEstimates] = useState<
    TravelTimeEstimate[]
  >([]);
  const [travelApiMessage, setTravelApiMessage] = useState<string | null>(null);
  const attemptedTransitCacheKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setTravelTimeEstimates(getTravelTimeEstimates());
  }, []);

  const transitions = useMemo(() => {
    return calculateWeeklyTravelTransitions({
      routines,
      singleSchedules,
      travelTimeRules,
      travelTimeEstimates,
      mode: selectedMode,
    });
  }, [
    routines,
    selectedMode,
    singleSchedules,
    travelTimeEstimates,
    travelTimeRules,
  ]);

  useEffect(() => {
    let isCancelled = false;

    async function calculateMissingTransitTimes() {
      if (selectedMode !== "transit") {
        return;
      }

      const missingTransitions = transitions.filter((transition) => {
        return transition.status === "unknown" && transition.cacheKey;
      });

      if (missingTransitions.length === 0) {
        return;
      }

      for (const transition of missingTransitions) {
        if (attemptedTransitCacheKeysRef.current.has(transition.cacheKey!)) {
          continue;
        }

        const fromPlace = getPlaceByName(savedPlaces, transition.fromPlaceName);
        const toPlace = getPlaceByName(savedPlaces, transition.toPlaceName);

        if (!fromPlace?.address || !toPlace?.address || !transition.cacheKey) {
          continue;
        }

        attemptedTransitCacheKeysRef.current.add(transition.cacheKey);

        try {
          const response = await fetch("/api/travel-time", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fromPlaceName: transition.fromPlaceName,
              toPlaceName: transition.toPlaceName,
              fromAddress: fromPlace.address,
              toAddress: toPlace.address,
              departureTime: transition.previousEndTime,
              mode: selectedMode,
            }),
          });
          const result = (await response.json()) as
            | {
                ok: true;
                provider: string;
                minutes: number;
              }
            | {
                ok: false;
                reason: string;
              };

          if (isCancelled) {
            return;
          }

          if (!result.ok) {
            setTravelApiMessage(result.reason);
            continue;
          }

          const now = new Date().toISOString();
          const estimate: TravelTimeEstimate = {
            id: createId(),
            fromPlaceName: transition.fromPlaceName,
            toPlaceName: transition.toPlaceName,
            fromAddress: fromPlace.address,
            toAddress: toPlace.address,
            departureTime: transition.previousEndTime,
            mode: selectedMode,
            minutes: result.minutes,
            provider: result.provider,
            cacheKey: createTravelTimeCacheKey({
              fromPlaceName: transition.fromPlaceName,
              toPlaceName: transition.toPlaceName,
              departureTime: transition.previousEndTime,
              mode: selectedMode,
            }),
            createdAt: now,
            updatedAt: now,
          };

          saveTravelTimeEstimate(estimate);
          setTravelTimeEstimates(getTravelTimeEstimates());
          setTravelApiMessage("대중교통 이동시간을 계산하고 캐시에 저장했습니다.");
        } catch {
          if (!isCancelled) {
            setTravelApiMessage("대중교통 이동시간 계산 요청에 실패했습니다.");
          }
        }
      }
    }

    calculateMissingTransitTimes();

    return () => {
      isCancelled = true;
    };
  }, [savedPlaces, selectedMode, transitions]);

  function handlePlaceNameChange(nextPlaceName: string) {
    setPlaceName(nextPlaceName);

    const savedPlace = getPlaceByName(savedPlaces, nextPlaceName);

    if (!savedPlace) {
      return;
    }

    setPlaceAddress(savedPlace.address);
    setPostalCode(savedPlace.postalCode ?? "");
    setPlaceMemo(savedPlace.memo ?? "");
  }

  function handleSavePlace() {
    if (!placeName.trim()) {
      alert("장소 이름을 입력해줘.");
      return;
    }

    if (!placeAddress.trim()) {
      alert("실제 주소를 검색해서 주소를 입력해줘.");
      return;
    }

    const now = new Date().toISOString();
    const existingPlace = getPlaceByName(savedPlaces, placeName);

    if (existingPlace) {
      updateSavedPlace({
        ...existingPlace,
        name: placeName.trim(),
        address: placeAddress.trim(),
        postalCode: postalCode.trim() || undefined,
        memo: placeMemo.trim(),
        provider: "daum-postcode",
        updatedAt: now,
      });
    } else {
      saveSavedPlace({
        id: createId(),
        name: placeName.trim(),
        address: placeAddress.trim(),
        postalCode: postalCode.trim() || undefined,
        memo: placeMemo.trim(),
        latitude: null,
        longitude: null,
        provider: "daum-postcode",
        providerPlaceId: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    setPlaceName("");
    setPlaceAddress("");
    setPostalCode("");
    setPlaceMemo("");
    onChange();
  }

  return (
    <section className="rounded-3xl bg-white p-4 shadow-soft ring-1 ring-slate-100 sm:p-5">
      <div>
        <h2 className="text-lg font-black text-slate-900">
          장소와 이동 준비
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          장소는 실제 주소와 함께 저장합니다. 일정 사이 장소가 바뀌고 여유가
          30분 이하일 때만 이동시간 계산 후보로 보여줍니다.
        </p>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-100">
          <h3 className="text-sm font-black text-slate-800">장소 저장</h3>

          <div className="mt-3 space-y-3">
            <input
              list="travel-place-options"
              value={placeName}
              onChange={(event) => handlePlaceNameChange(event.target.value)}
              placeholder="장소 이름: 집, 학교, 영어학원"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400"
            />
            <datalist id="travel-place-options">
              {savedPlaces.map((place) => (
                <option key={place.id} value={place.name} />
              ))}
            </datalist>

            <div className="rounded-3xl bg-white p-3 ring-1 ring-slate-100">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-black text-slate-800">
                    위치와 실제 주소
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                    정기 일정 입력과 같은 우편번호 검색으로 도로명 주소를
                    선택합니다.
                  </p>
                </div>
                <div className="w-full sm:w-44">
                  <PostcodeAddressSearch
                    onSelect={({ address, postalCode, detailHint }) => {
                      setPlaceAddress(address);
                      setPostalCode(postalCode);

                      if (!placeName.trim() && detailHint) {
                        setPlaceName(detailHint.split(",")[0]);
                      }
                    }}
                  />
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_140px]">
                <input
                  value={placeAddress}
                  onChange={(event) => setPlaceAddress(event.target.value)}
                  placeholder="우편번호 검색 후 도로명 주소가 들어옵니다"
                  className="min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400"
                />
                <input
                  value={postalCode}
                  onChange={(event) => setPostalCode(event.target.value)}
                  placeholder="우편번호"
                  inputMode="numeric"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400"
                />
              </div>
              <p className="mt-2 rounded-2xl bg-slate-50 p-3 text-xs font-bold leading-5 text-slate-500">
                같은 장소 이름이 이미 있으면 새로 만들지 않고 주소와 메모를
                업데이트합니다.
              </p>
            </div>

            <input
              value={placeMemo}
              onChange={(event) => setPlaceMemo(event.target.value)}
              placeholder="메모: 건물명, 층수, 출입구"
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
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-900">
                      {place.name}
                    </p>
                    {place.address && (
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {place.address}
                      </p>
                    )}
                    {place.postalCode && (
                      <p className="mt-1 text-xs font-bold text-slate-400">
                        우편번호 {place.postalCode}
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-800">
                이동시간 자동 계산 준비
              </h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                장소가 바뀌는 일정 중 여유가 30분 이하인 경우만 확인합니다.
                같은 출발지, 출발시각, 도착지, 이동수단이면 저장된 계산값을
                다시 사용합니다.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {TRAVEL_MODES.map((travelMode) => (
              <button
                key={travelMode.value}
                type="button"
                onClick={() => setSelectedMode(travelMode.value)}
                className={`rounded-2xl px-3 py-3 text-center transition ${
                  selectedMode === travelMode.value
                    ? "bg-blue-600 text-white shadow-[0_10px_20px_rgba(37,99,235,0.2)]"
                    : "bg-white text-slate-600 ring-1 ring-slate-100"
                }`}
              >
                <span className="block text-sm font-black">
                  {travelMode.label}
                </span>
                <span className="mt-0.5 block text-[11px] font-bold opacity-75">
                  {travelMode.hint}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            {travelApiMessage && (
              <p className="rounded-2xl bg-blue-50 p-3 text-sm font-bold leading-6 text-blue-700 ring-1 ring-blue-100">
                {travelApiMessage}
              </p>
            )}

            {transitions.length === 0 ? (
              <p className="rounded-2xl bg-white p-3 text-sm leading-6 text-slate-500">
                이번 주에는 장소가 바뀌면서 여유가 30분 이하인 이어지는 일정이
                없습니다.
              </p>
            ) : (
              transitions.map((transition) => (
                <article
                  key={`${transition.date}-${transition.fromTitle}-${transition.toTitle}-${transition.previousEndTime}`}
                  className="rounded-2xl bg-white p-4 ring-1 ring-slate-100"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900">
                        {transition.date} · {transition.fromTitle} →{" "}
                        {transition.toTitle}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {transition.fromPlaceName} → {transition.toPlaceName}
                      </p>
                    </div>

                    <span
                      className={`w-fit rounded-full px-3 py-1 text-xs font-black ring-1 ${getStatusStyle(
                        transition.status
                      )}`}
                    >
                      {getStatusLabel(transition.status)}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    이전 일정 종료 {transition.previousEndTime}, 다음 일정
                    시작 {transition.nextStartTime}. 사이 시간은{" "}
                    <span className="font-black">
                      {formatMinutes(transition.gapMinutes)}
                    </span>
                    입니다.
                    {transition.requiredMinutes === null
                      ? ` ${getModeLabel(
                          transition.mode
                        )} 기준 이동시간은 API 연결 후 자동 계산됩니다.`
                      : ` ${getModeLabel(
                          transition.mode
                        )} 예상 이동시간은 ${formatMinutes(
                          transition.requiredMinutes
                        )}입니다.`}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <p className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm leading-6 text-blue-700 ring-1 ring-blue-100">
        카카오 API 외에는 Google Maps Distance Matrix, Naver Maps Directions,
        TMAP, 공공데이터포털 교통 API, 직접 저장한 과거 이동시간 평균을 사용할
        수 있습니다. 국내 대중교통 정확도는 카카오/네이버/TMAP 쪽이 현실적인
        편입니다.
      </p>
    </section>
  );
}
