"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getCloudDataSyncedEventName } from "@/lib/dataSyncEvents";
import {
  deleteSavedPlace,
  getSavedPlaces,
  inferSavedPlaceType,
  saveSavedPlace,
  updateSavedPlace,
} from "@/lib/placeStorage";
import type { PlaceSearchResult } from "@/components/PlaceKeywordSearch";
import PlaceKeywordSearch from "@/components/PlaceKeywordSearch";
import PostcodeAddressSearch from "@/components/PostcodeAddressSearch";
import type { SavedPlace } from "@/types/calendar";

type PlaceDraft = {
  id: string | null;
  name: string;
  address: string;
  postalCode: string;
  placeType: NonNullable<SavedPlace["placeType"]>;
  categoryName: string;
  phone: string;
  placeUrl: string;
  businessHoursStart: string;
  businessHoursEnd: string;
  preferredVisitStartTime: string;
  preferredVisitEndTime: string;
  typicalStayMinutes: string;
  needsShowerAfterVisit: boolean;
  memo: string;
  latitude: number | null;
  longitude: number | null;
  provider: string | null;
  providerPlaceId: string | null;
};

type PlaceType = NonNullable<SavedPlace["placeType"]>;

const PLACE_TYPES: Array<{
  value: PlaceType;
  label: string;
}> = [
  { value: "home", label: "집" },
  { value: "work", label: "회사" },
  { value: "school", label: "학교/학원" },
  { value: "gym", label: "운동" },
  { value: "salon", label: "미용/예약" },
  { value: "shop", label: "가게" },
  { value: "other", label: "기타" },
];

const PLACE_TYPE_LABELS = Object.fromEntries(
  PLACE_TYPES.map((type) => [type.value, type.label])
) as Record<PlaceType, string>;

function getPlaceTypeOrOther(placeType: SavedPlace["placeType"]): PlaceType {
  return placeType ?? "other";
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getDefaultDetails(placeType: SavedPlace["placeType"]) {
  if (placeType === "gym") {
    return {
      businessHoursStart: "06:00",
      businessHoursEnd: "23:00",
      preferredVisitStartTime: "17:00",
      preferredVisitEndTime: "21:30",
      typicalStayMinutes: "90",
      needsShowerAfterVisit: true,
    };
  }

  if (placeType === "salon") {
    return {
      businessHoursStart: "10:00",
      businessHoursEnd: "20:00",
      preferredVisitStartTime: "10:00",
      preferredVisitEndTime: "19:00",
      typicalStayMinutes: "60",
      needsShowerAfterVisit: false,
    };
  }

  if (placeType === "shop") {
    return {
      businessHoursStart: "11:00",
      businessHoursEnd: "22:00",
      preferredVisitStartTime: "11:00",
      preferredVisitEndTime: "20:00",
      typicalStayMinutes: "45",
      needsShowerAfterVisit: false,
    };
  }

  return {
    businessHoursStart: "",
    businessHoursEnd: "",
    preferredVisitStartTime: "",
    preferredVisitEndTime: "",
    typicalStayMinutes: "",
    needsShowerAfterVisit: false,
  };
}

function createEmptyDraft(): PlaceDraft {
  return {
    id: null,
    name: "",
    address: "",
    postalCode: "",
    placeType: "other",
    categoryName: "",
    phone: "",
    placeUrl: "",
    businessHoursStart: "",
    businessHoursEnd: "",
    preferredVisitStartTime: "",
    preferredVisitEndTime: "",
    typicalStayMinutes: "",
    needsShowerAfterVisit: false,
    memo: "",
    latitude: null,
    longitude: null,
    provider: null,
    providerPlaceId: null,
  };
}

function createDraftFromPlace(place: SavedPlace): PlaceDraft {
  return {
    id: place.id,
    name: place.name,
    address: place.address,
    postalCode: place.postalCode ?? "",
    placeType: getPlaceTypeOrOther(
      place.placeType ?? inferSavedPlaceType(place.name, place.memo)
    ),
    categoryName: place.categoryName ?? "",
    phone: place.phone ?? "",
    placeUrl: place.placeUrl ?? "",
    businessHoursStart: place.businessHoursStart ?? "",
    businessHoursEnd: place.businessHoursEnd ?? "",
    preferredVisitStartTime: place.preferredVisitStartTime ?? "",
    preferredVisitEndTime: place.preferredVisitEndTime ?? "",
    typicalStayMinutes: place.typicalStayMinutes
      ? String(place.typicalStayMinutes)
      : "",
    needsShowerAfterVisit: place.needsShowerAfterVisit ?? false,
    memo: place.memo,
    latitude: place.latitude ?? null,
    longitude: place.longitude ?? null,
    provider: place.provider ?? null,
    providerPlaceId: place.providerPlaceId ?? null,
  };
}

function normalizeDraft(draft: PlaceDraft, existingPlace?: SavedPlace): SavedPlace {
  const now = new Date().toISOString();
  const typicalStayMinutes = Number(draft.typicalStayMinutes);

  return {
    id: draft.id ?? existingPlace?.id ?? createId(),
    name: draft.name.trim(),
    address: draft.address.trim(),
    postalCode: draft.postalCode.trim() || undefined,
    placeType: draft.placeType,
    categoryName: draft.categoryName.trim() || undefined,
    phone: draft.phone.trim() || undefined,
    placeUrl: draft.placeUrl.trim() || undefined,
    businessHoursStart: draft.businessHoursStart || undefined,
    businessHoursEnd: draft.businessHoursEnd || undefined,
    preferredVisitStartTime: draft.preferredVisitStartTime || undefined,
    preferredVisitEndTime: draft.preferredVisitEndTime || undefined,
    typicalStayMinutes:
      Number.isFinite(typicalStayMinutes) && typicalStayMinutes > 0
        ? typicalStayMinutes
        : undefined,
    needsShowerAfterVisit: draft.needsShowerAfterVisit,
    memo: draft.memo.trim(),
    latitude: draft.latitude,
    longitude: draft.longitude,
    provider: draft.provider,
    providerPlaceId: draft.providerPlaceId,
    createdAt: existingPlace?.createdAt ?? now,
    updatedAt: now,
  };
}

function applyPlaceSearchResult(place: PlaceSearchResult): PlaceDraft {
  const placeType = getPlaceTypeOrOther(
    place.placeType ?? inferSavedPlaceType(place.name, place.categoryName ?? "")
  );
  const defaults = getDefaultDetails(placeType);

  return {
    ...createEmptyDraft(),
    ...defaults,
    name: place.name,
    address: place.address,
    placeType,
    categoryName: place.categoryName ?? "",
    phone: place.phone ?? "",
    placeUrl: place.placeUrl ?? "",
    businessHoursStart: place.businessHoursStart ?? defaults.businessHoursStart,
    businessHoursEnd: place.businessHoursEnd ?? defaults.businessHoursEnd,
    latitude: place.latitude ?? null,
    longitude: place.longitude ?? null,
    provider: place.provider ?? null,
    providerPlaceId: place.providerPlaceId ?? null,
  };
}

export default function SavedPlaceManager() {
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [draft, setDraft] = useState<PlaceDraft>(() => createEmptyDraft());
  const [message, setMessage] = useState<string | null>(null);

  const sortedPlaces = useMemo(() => {
    return [...places].sort((a, b) => {
      const typeCompare = (a.placeType ?? "other").localeCompare(
        b.placeType ?? "other"
      );
      if (typeCompare !== 0) return typeCompare;
      return a.name.localeCompare(b.name);
    });
  }, [places]);

  function refreshPlaces() {
    setPlaces(getSavedPlaces());
  }

  useEffect(() => {
    refreshPlaces();

    window.addEventListener("storage", refreshPlaces);
    window.addEventListener(getCloudDataSyncedEventName(), refreshPlaces);

    return () => {
      window.removeEventListener("storage", refreshPlaces);
      window.removeEventListener(getCloudDataSyncedEventName(), refreshPlaces);
    };
  }, []);

  function updateDraft(changes: Partial<PlaceDraft>) {
    setDraft((current) => ({ ...current, ...changes }));
  }

  function handleTypeChange(placeType: PlaceType) {
    const defaults = getDefaultDetails(placeType);
    setDraft((current) => ({
      ...current,
      placeType,
      businessHoursStart: current.businessHoursStart || defaults.businessHoursStart,
      businessHoursEnd: current.businessHoursEnd || defaults.businessHoursEnd,
      preferredVisitStartTime:
        current.preferredVisitStartTime || defaults.preferredVisitStartTime,
      preferredVisitEndTime:
        current.preferredVisitEndTime || defaults.preferredVisitEndTime,
      typicalStayMinutes: current.typicalStayMinutes || defaults.typicalStayMinutes,
      needsShowerAfterVisit:
        current.needsShowerAfterVisit || defaults.needsShowerAfterVisit,
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.name.trim() || !draft.address.trim()) {
      setMessage("장소 이름과 주소는 꼭 필요해.");
      return;
    }

    const existingPlace =
      places.find((place) => place.id === draft.id) ??
      places.find(
        (place) =>
          place.name.trim().toLowerCase() === draft.name.trim().toLowerCase() &&
          place.address.trim().toLowerCase() === draft.address.trim().toLowerCase()
      );
    const savedPlace = normalizeDraft(draft, existingPlace);

    if (existingPlace) {
      updateSavedPlace(savedPlace);
      setMessage(`${savedPlace.name} 정보를 업데이트했어.`);
    } else {
      saveSavedPlace(savedPlace);
      setMessage(`${savedPlace.name}을 저장했어.`);
    }

    refreshPlaces();
    setDraft(createEmptyDraft());
  }

  function handleDelete(place: SavedPlace) {
    deleteSavedPlace(place.id);
    refreshPlaces();
    if (draft.id === place.id) {
      setDraft(createEmptyDraft());
    }
    setMessage(`${place.name}을 삭제했어.`);
  }

  return (
    <section className="app-card p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-blue-600">
            place memory
          </p>
          <h2 className="mt-1 text-xl font-black text-slate-950">
            자주 가는 장소
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            헬스장, 미용실, 학원처럼 자주 가는 곳을 저장하면 빈 시간 추천이
            위치와 운영시간을 함께 고려합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setDraft(createEmptyDraft());
            setMessage(null);
          }}
          className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700"
        >
          새 장소
        </button>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="space-y-4">
          <PlaceKeywordSearch
            defaultQuery={draft.name}
            onSelect={(place) => {
              setDraft(applyPlaceSearchResult(place));
              setMessage("검색한 장소를 불러왔어. 필요한 값만 확인하고 저장해줘.");
            }}
          />

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-black text-slate-700">
                장소 이름
                <input
                  value={draft.name}
                  onChange={(event) => updateDraft({ name: event.target.value })}
                  placeholder="예: 다니는 헬스장"
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-400"
                />
              </label>
              <label className="text-sm font-black text-slate-700">
                유형
                <select
                  value={draft.placeType}
                  onChange={(event) =>
                    handleTypeChange(
                      event.target.value as PlaceType
                    )
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm font-black outline-none focus:border-blue-400"
                >
                  {PLACE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
              <label className="text-sm font-black text-slate-700">
                주소
                <input
                  value={draft.address}
                  onChange={(event) =>
                    updateDraft({ address: event.target.value })
                  }
                  placeholder="우편번호 검색 또는 장소 검색으로 입력"
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-400"
                />
              </label>
              <label className="text-sm font-black text-slate-700">
                우편번호
                <input
                  value={draft.postalCode}
                  onChange={(event) =>
                    updateDraft({ postalCode: event.target.value })
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-400"
                />
              </label>
            </div>

            <PostcodeAddressSearch
              buttonLabel="우편번호로 주소 선택"
              onSelect={(result) =>
                updateDraft({
                  address: result.address,
                  postalCode: result.postalCode,
                  memo: draft.memo || result.detailHint,
                })
              }
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-black text-slate-700">
                영업 시작
                <input
                  type="time"
                  value={draft.businessHoursStart}
                  onChange={(event) =>
                    updateDraft({ businessHoursStart: event.target.value })
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm font-black outline-none focus:border-blue-400"
                />
              </label>
              <label className="text-sm font-black text-slate-700">
                영업 종료
                <input
                  type="time"
                  value={draft.businessHoursEnd}
                  onChange={(event) =>
                    updateDraft({ businessHoursEnd: event.target.value })
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm font-black outline-none focus:border-blue-400"
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm font-black text-slate-700">
                선호 시작
                <input
                  type="time"
                  value={draft.preferredVisitStartTime}
                  onChange={(event) =>
                    updateDraft({ preferredVisitStartTime: event.target.value })
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm font-black outline-none focus:border-blue-400"
                />
              </label>
              <label className="text-sm font-black text-slate-700">
                선호 종료
                <input
                  type="time"
                  value={draft.preferredVisitEndTime}
                  onChange={(event) =>
                    updateDraft({ preferredVisitEndTime: event.target.value })
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm font-black outline-none focus:border-blue-400"
                />
              </label>
              <label className="text-sm font-black text-slate-700">
                평균 체류
                <input
                  type="number"
                  min="5"
                  step="5"
                  value={draft.typicalStayMinutes}
                  onChange={(event) =>
                    updateDraft({ typicalStayMinutes: event.target.value })
                  }
                  placeholder="분"
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm font-black outline-none focus:border-blue-400"
                />
              </label>
            </div>

            <label className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-black text-slate-700 ring-1 ring-slate-100">
              방문 후 샤워/정리 시간이 필요해요
              <input
                type="checkbox"
                checked={draft.needsShowerAfterVisit}
                onChange={(event) =>
                  updateDraft({ needsShowerAfterVisit: event.target.checked })
                }
                className="h-5 w-5 accent-blue-600"
              />
            </label>

            <label className="text-sm font-black text-slate-700">
              메모
              <textarea
                value={draft.memo}
                onChange={(event) => updateDraft({ memo: event.target.value })}
                placeholder="예: 주로 저녁에 방문, 샤워 가능, 예약 필요"
                className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-400"
              />
            </label>

            {message && (
              <p className="rounded-2xl bg-blue-50 p-3 text-sm font-bold leading-6 text-blue-700 ring-1 ring-blue-100">
                {message}
              </p>
            )}

            <button
              type="submit"
              className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-[0_14px_30px_rgba(37,99,235,0.22)]"
            >
              {draft.id ? "장소 수정" : "장소 저장"}
            </button>
          </form>
        </div>

        <div className="space-y-3">
          {sortedPlaces.length === 0 ? (
            <div className="rounded-3xl bg-slate-50 p-5 text-sm font-bold leading-6 text-slate-500 ring-1 ring-slate-100">
              아직 저장된 장소가 없어. 자주 가는 헬스장, 미용실, 학원부터
              저장해두면 추천이 훨씬 현실적으로 바뀝니다.
            </div>
          ) : (
            sortedPlaces.map((place) => (
              <article
                key={place.id}
                className="rounded-3xl bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.06)] ring-1 ring-slate-100"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-950">
                      {place.name}
                    </p>
                    <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
                      {place.address}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-600">
                    {PLACE_TYPE_LABELS[
                      getPlaceTypeOrOther(
                        place.placeType ?? inferSavedPlaceType(place.name, place.memo)
                      )
                    ] ?? "기타"}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {place.businessHoursStart && place.businessHoursEnd && (
                    <span className="rounded-full bg-slate-50 px-2 py-1 text-[11px] font-black text-slate-500">
                      영업 {place.businessHoursStart}-{place.businessHoursEnd}
                    </span>
                  )}
                  {place.preferredVisitStartTime && place.preferredVisitEndTime && (
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700">
                      선호 {place.preferredVisitStartTime}-
                      {place.preferredVisitEndTime}
                    </span>
                  )}
                  {place.typicalStayMinutes && (
                    <span className="rounded-full bg-violet-50 px-2 py-1 text-[11px] font-black text-violet-700">
                      {place.typicalStayMinutes}분 체류
                    </span>
                  )}
                  {place.needsShowerAfterVisit && (
                    <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-black text-amber-700">
                      정리시간 필요
                    </span>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(createDraftFromPlace(place));
                      setMessage(`${place.name}을 수정 중이야.`);
                    }}
                    className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(place)}
                    className="rounded-2xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-600"
                  >
                    삭제
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
