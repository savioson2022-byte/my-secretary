"use client";

import PostcodeAddressSearch from "@/components/PostcodeAddressSearch";
import ScheduleColorPicker from "@/components/ScheduleColorPicker";
import {
  getSavedPlaces,
  inferSavedPlaceType,
  saveSavedPlace,
  updateSavedPlace,
} from "@/lib/placeStorage";
import {
  DEFAULT_SINGLE_SCHEDULE_COLOR,
  getScheduleColor,
} from "@/lib/scheduleColors";
import { updateSingleSchedule } from "@/lib/singleScheduleStorage";
import { getUserProfile } from "@/lib/userProfileStorage";
import { SavedPlace, SingleSchedule, TravelMode } from "@/types/calendar";
import { useMemo, useState } from "react";

type SingleScheduleListProps = {
  schedules: SingleSchedule[];
  onDelete: (id: string) => void;
};

function sortSchedulesByDateTime(schedules: SingleSchedule[]) {
  return [...schedules].sort((a, b) => {
    const aValue = `${a.date} ${a.startTime}`;
    const bValue = `${b.date} ${b.startTime}`;

    return aValue.localeCompare(bValue);
  });
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getDefaultTravelMode(): TravelMode {
  if (typeof window === "undefined") return "transit";

  return getUserProfile()?.preferredTravelMode ?? "transit";
}

function getSavedPlaceByName(places: SavedPlace[], placeName: string) {
  const normalizedPlaceName = placeName.trim().toLowerCase();

  return places.find((place) => {
    return place.name.trim().toLowerCase() === normalizedPlaceName;
  });
}

const TRAVEL_MODE_OPTIONS: Array<{ value: TravelMode; label: string }> = [
  { value: "walk", label: "도보" },
  { value: "transit", label: "대중교통" },
  { value: "car", label: "자차" },
];

export default function SingleScheduleList({
  schedules,
  onDelete,
}: SingleScheduleListProps) {
  const sortedSchedules = sortSchedulesByDateTime(schedules);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editPlaceName, setEditPlaceName] = useState("");
  const [editPlaceAddress, setEditPlaceAddress] = useState("");
  const [editPlacePostalCode, setEditPlacePostalCode] = useState("");
  const [editTravelMode, setEditTravelMode] =
    useState<TravelMode>(getDefaultTravelMode);
  const [editMemo, setEditMemo] = useState("");
  const [editColor, setEditColor] = useState(DEFAULT_SINGLE_SCHEDULE_COLOR);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>(() =>
    typeof window === "undefined" ? [] : getSavedPlaces()
  );
  const placeNameOptions = useMemo(() => {
    const names = new Set<string>();

    savedPlaces.forEach((place) => {
      if (place.name.trim()) {
        names.add(place.name.trim());
      }
    });

    schedules.forEach((schedule) => {
      if (schedule.placeName.trim()) {
        names.add(schedule.placeName.trim());
      }
    });

    return Array.from(names).sort((a, b) => a.localeCompare(b, "ko"));
  }, [savedPlaces, schedules]);

  function startEdit(schedule: SingleSchedule) {
    setEditingId(schedule.id);
    setEditTitle(schedule.title);
    setEditDate(schedule.date);
    setEditStartTime(schedule.startTime);
    setEditEndTime(schedule.endTime);
    setEditPlaceName(schedule.placeName);
    setEditPlaceAddress(schedule.placeAddress ?? "");
    setEditPlacePostalCode(schedule.placePostalCode ?? "");
    setEditTravelMode(schedule.travelMode ?? getDefaultTravelMode());
    setEditMemo(schedule.memo);
    setEditColor(getScheduleColor(schedule.color, DEFAULT_SINGLE_SCHEDULE_COLOR));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle("");
    setEditDate("");
    setEditStartTime("");
    setEditEndTime("");
    setEditPlaceName("");
    setEditPlaceAddress("");
    setEditPlacePostalCode("");
    setEditTravelMode(getDefaultTravelMode());
    setEditMemo("");
    setEditColor(DEFAULT_SINGLE_SCHEDULE_COLOR);
  }

  function handlePlaceNameChange(nextPlaceName: string) {
    setEditPlaceName(nextPlaceName);

    const savedPlace = getSavedPlaceByName(savedPlaces, nextPlaceName);

    if (!savedPlace) {
      return;
    }

    setEditPlaceAddress(savedPlace.address);
    setEditPlacePostalCode(savedPlace.postalCode ?? "");
  }

  function savePlaceIfNeeded() {
    const trimmedPlaceName = editPlaceName.trim();
    const trimmedAddress = editPlaceAddress.trim();

    if (!trimmedPlaceName || !trimmedAddress) {
      return;
    }

    const now = new Date().toISOString();
    const existingPlace = getSavedPlaceByName(savedPlaces, trimmedPlaceName);

    if (existingPlace) {
      updateSavedPlace({
        ...existingPlace,
        name: trimmedPlaceName,
        address: trimmedAddress,
        postalCode: editPlacePostalCode.trim() || undefined,
        placeType: inferSavedPlaceType(trimmedPlaceName, existingPlace.memo),
        updatedAt: now,
      });
    } else {
      saveSavedPlace({
        id: createId(),
        name: trimmedPlaceName,
        address: trimmedAddress,
        postalCode: editPlacePostalCode.trim() || undefined,
        placeType: inferSavedPlaceType(trimmedPlaceName),
        memo: "",
        latitude: null,
        longitude: null,
        provider: "daum-postcode",
        providerPlaceId: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    setSavedPlaces(getSavedPlaces());
  }

  function saveEdit(schedule: SingleSchedule) {
    if (!editTitle.trim()) {
      alert("일정 제목을 입력해줘.");
      return;
    }

    if (!editDate) {
      alert("날짜를 입력해줘.");
      return;
    }

    if (!editStartTime || !editEndTime) {
      alert("시작 시간과 종료 시간을 입력해줘.");
      return;
    }

    if (editStartTime >= editEndTime) {
      alert("종료 시간은 시작 시간보다 늦어야 해.");
      return;
    }

    updateSingleSchedule({
      ...schedule,
      title: editTitle.trim(),
      date: editDate,
      startTime: editStartTime,
      endTime: editEndTime,
      placeName: editPlaceName.trim(),
      placeAddress: editPlaceAddress.trim() || undefined,
      placePostalCode: editPlacePostalCode.trim() || undefined,
      travelMode: editTravelMode,
      memo: editMemo.trim(),
      color: editColor,
      updatedAt: new Date().toISOString(),
    });
    savePlaceIfNeeded();

    cancelEdit();
  }

  return (
    <section className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
      <div>
        <h3 className="text-base font-black text-slate-900">단기 일정</h3>
        <p className="mt-1 text-sm text-slate-500">
          한 번만 발생하는 병원, 약속, 시험, 보강 같은 일정이 여기에 표시됩니다.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {sortedSchedules.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-sm text-slate-500">
            아직 등록된 단기 일정이 없습니다.
          </p>
        ) : (
          sortedSchedules.map((schedule) => {
            const isEditing = editingId === schedule.id;
            const scheduleColor = getScheduleColor(
              schedule.color,
              DEFAULT_SINGLE_SCHEDULE_COLOR
            );

            return (
              <article
                key={schedule.id}
                className="rounded-2xl border border-slate-100 bg-white p-4"
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-bold text-slate-700">
                        일정 제목
                      </label>
                      <input
                        value={editTitle}
                        onChange={(event) => setEditTitle(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div>
                        <label className="text-sm font-bold text-slate-700">
                          날짜
                        </label>
                        <input
                          type="date"
                          value={editDate}
                          onChange={(event) => setEditDate(event.target.value)}
                          className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-bold text-slate-700">
                          시작
                        </label>
                        <input
                          type="time"
                          value={editStartTime}
                          onChange={(event) =>
                            setEditStartTime(event.target.value)
                          }
                          className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-bold text-slate-700">
                          종료
                        </label>
                        <input
                          type="time"
                          value={editEndTime}
                          onChange={(event) =>
                            setEditEndTime(event.target.value)
                          }
                          className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
                        />
                      </div>
                    </div>

                    <div className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-100">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <label className="text-sm font-bold text-slate-700">
                            위치와 실제 주소
                          </label>
                          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                            우편번호 검색으로 도로명 주소를 선택하면 이동시간
                            계산에 사용할 수 있습니다.
                          </p>
                        </div>
                        <div className="w-full md:w-44">
                          <PostcodeAddressSearch
                            onSelect={({ address, postalCode, detailHint }) => {
                              setEditPlaceAddress(address);
                              setEditPlacePostalCode(postalCode);

                              if (!editPlaceName.trim() && detailHint) {
                                setEditPlaceName(detailHint.split(",")[0]);
                              }
                            }}
                          />
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-[0.8fr_1.2fr]">
                        <div>
                          <input
                            list="single-place-options"
                            value={editPlaceName}
                            onChange={(event) =>
                              handlePlaceNameChange(event.target.value)
                            }
                            placeholder="장소 이름: 병원, 학교, 카페"
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400"
                          />
                          <datalist id="single-place-options">
                            {placeNameOptions.map((name) => (
                              <option key={name} value={name} />
                            ))}
                          </datalist>
                        </div>

                        <input
                          value={editPlaceAddress}
                          onChange={(event) =>
                            setEditPlaceAddress(event.target.value)
                          }
                          placeholder="우편번호 검색 후 도로명 주소가 들어옵니다"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400"
                        />
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-[160px_1fr]">
                        <input
                          value={editPlacePostalCode}
                          onChange={(event) =>
                            setEditPlacePostalCode(event.target.value)
                          }
                          placeholder="우편번호"
                          inputMode="numeric"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400"
                        />
                        <select
                          value={editTravelMode}
                          onChange={(event) =>
                            setEditTravelMode(event.target.value as TravelMode)
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-emerald-400"
                        >
                          {TRAVEL_MODE_OPTIONS.map((mode) => (
                            <option key={mode.value} value={mode.value}>
                              이동수단: {mode.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-bold text-slate-700">
                        메모
                      </label>
                      <input
                        value={editMemo}
                        onChange={(event) => setEditMemo(event.target.value)}
                        placeholder="예: 준비물, 약속 내용, 참고사항"
                        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
                      />
                    </div>

                    <ScheduleColorPicker
                      label="캘린더 색인"
                      value={editColor}
                      onChange={setEditColor}
                    />

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveEdit(schedule)}
                        className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700"
                      >
                        저장
                      </button>

                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: scheduleColor }}
                        />
                        <p className="truncate font-black text-slate-900">
                          {schedule.title}
                        </p>
                      </div>

                      <p className="mt-1 text-sm font-semibold text-slate-600">
                        {schedule.date} {schedule.startTime} ~{" "}
                        {schedule.endTime}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        위치: {schedule.placeName || "아직 입력 안 됨"}
                      </p>

                      {schedule.placeAddress && (
                        <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">
                          {schedule.placeAddress}
                          {schedule.placePostalCode
                            ? ` · ${schedule.placePostalCode}`
                            : ""}
                        </p>
                      )}

                      {schedule.memo && (
                        <p className="mt-1 text-sm text-slate-500">
                          메모: {schedule.memo}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(schedule)}
                        className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                      >
                        수정
                      </button>

                      <button
                        type="button"
                        onClick={() => onDelete(schedule.id)}
                        className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-red-500 ring-1 ring-red-100 hover:bg-red-50"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
