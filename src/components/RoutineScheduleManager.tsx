"use client";

import TimeTaskSuggestionView from "@/components/TimeTaskSuggestionView";
import TravelTimePlanner from "@/components/TravelTimePlanner";
import WeeklyAvailabilityView from "@/components/WeeklyAvailabilityView";
import PostcodeAddressSearch from "@/components/PostcodeAddressSearch";
import ScheduleColorPicker from "@/components/ScheduleColorPicker";
import {
  getSavedPlaces,
  saveSavedPlace,
  updateSavedPlace,
} from "@/lib/placeStorage";
import {
  deleteRoutineSchedule,
  getRoutineSchedules,
  saveRoutineSchedule,
  updateRoutineSchedule,
} from "@/lib/routineStorage";
import {
  DEFAULT_ROUTINE_SCHEDULE_COLOR,
  DEFAULT_SINGLE_SCHEDULE_COLOR,
  getScheduleColor,
  getSoftColorStyle,
} from "@/lib/scheduleColors";
import {
  getSingleScheduleUpdatedEventName,
  getSingleSchedules,
} from "@/lib/singleScheduleStorage";
import { getTravelTimeRules } from "@/lib/travelTimeStorage";
import { AssistantItem } from "@/types/assistant";
import { SavedPlace, SingleSchedule, TravelTimeRule } from "@/types/calendar";
import { DayOfWeek, RoutineSchedule } from "@/types/routine";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent, PointerEvent } from "react";

const DAYS: DayOfWeek[] = ["월", "화", "수", "목", "금", "토", "일"];

const START_HOUR = 0;
const END_HOUR = 24;
const HOUR_HEIGHT = 56;
const MOBILE_HOUR_HEIGHT = 26;
const SNAP_MINUTES = 10;

type DragSelection = {
  day: DayOfWeek;
  startMinutes: number;
  endMinutes: number;
};

type RoutineScheduleManagerProps = {
  items: AssistantItem[];
};

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getTodayText() {
  return toDateText(new Date());
}

function timeToMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function minutesToTime(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function snapMinutes(minutes: number) {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getRoutineTop(startTime: string) {
  const startMinutes = timeToMinutes(startTime);
  const baseMinutes = START_HOUR * 60;

  return ((startMinutes - baseMinutes) / 60) * HOUR_HEIGHT;
}

function getRoutineHeight(startTime: string, endTime: string) {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  return ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT;
}

function getScheduleTop(startTime: string, hourHeight: number) {
  const startMinutes = timeToMinutes(startTime);
  const baseMinutes = START_HOUR * 60;

  return ((startMinutes - baseMinutes) / 60) * hourHeight;
}

function getScheduleHeight(
  startTime: string,
  endTime: string,
  hourHeight: number
) {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  return ((endMinutes - startMinutes) / 60) * hourHeight;
}

function getMinutesFromMouse(
  event: PointerEvent<HTMLDivElement>,
  element: HTMLDivElement,
  hourHeight = HOUR_HEIGHT
) {
  const rect = element.getBoundingClientRect();
  const y = event.clientY - rect.top;

  const minutesFromStart = (y / hourHeight) * 60;
  const rawMinutes = START_HOUR * 60 + minutesFromStart;

  return clamp(snapMinutes(rawMinutes), START_HOUR * 60, END_HOUR * 60);
}

function normalizeSelection(selection: DragSelection) {
  const start = Math.min(selection.startMinutes, selection.endMinutes);
  let end = Math.max(selection.startMinutes, selection.endMinutes);

  if (start === end) {
    end = start + SNAP_MINUTES;
  }

  return {
    day: selection.day,
    startMinutes: start,
    endMinutes: clamp(end, START_HOUR * 60, END_HOUR * 60),
  };
}

function isRoutineEnded(routine: RoutineSchedule) {
  if (!routine.endDate) return false;

  const today = getTodayText();

  return routine.endDate < today;
}

function isRoutineBeforeStart(routine: RoutineSchedule) {
  if (!routine.startDate) return false;

  const today = getTodayText();

  return routine.startDate > today;
}

function isRoutineVisibleInTimetable(routine: RoutineSchedule) {
  if (routine.isActive === false) return false;
  if (isRoutineEnded(routine)) return false;
  if (isRoutineBeforeStart(routine)) return false;

  return true;
}

function getTodayDateOnly() {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

function getStartOfWeekMonday(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  return addDays(date, diff);
}

function toDateText(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatMonthDay(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function isRoutineActiveOnDate(routine: RoutineSchedule, dateText: string) {
  if (routine.isActive === false) return false;

  if (routine.startDate && routine.startDate > dateText) {
    return false;
  }

  if (routine.endDate && routine.endDate < dateText) {
    return false;
  }

  return true;
}

function RoutineScheduleManager({ items }: RoutineScheduleManagerProps) {
  const [routines, setRoutines] = useState<RoutineSchedule[]>([]);
  const [singleSchedules, setSingleSchedules] = useState<SingleSchedule[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [travelTimeRules, setTravelTimeRules] = useState<TravelTimeRule[]>([]);

  const [title, setTitle] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>("월");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [placeName, setPlaceName] = useState("");
  const [placeAddress, setPlaceAddress] = useState("");
  const [placePostalCode, setPlacePostalCode] = useState("");
  const [memo, setMemo] = useState("");
  const [color, setColor] = useState(DEFAULT_ROUTINE_SCHEDULE_COLOR);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [dragSelection, setDragSelection] = useState<DragSelection | null>(
    null
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedMobileDateText, setSelectedMobileDateText] = useState(() =>
    getTodayText()
  );

  useEffect(() => {
    function refreshSchedules() {
      setRoutines(getRoutineSchedules());
      setSingleSchedules(getSingleSchedules());
      setSavedPlaces(getSavedPlaces());
      setTravelTimeRules(getTravelTimeRules());
    }

    refreshSchedules();

    window.addEventListener(
      getSingleScheduleUpdatedEventName(),
      refreshSchedules
    );

    return () => {
      window.removeEventListener(
        getSingleScheduleUpdatedEventName(),
        refreshSchedules
      );
    };
  }, []);

  const hours = useMemo(() => {
    return Array.from({ length: END_HOUR - START_HOUR }, (_, index) => {
      return START_HOUR + index;
    });
  }, []);

  const today = useMemo(() => getTodayDateOnly(), []);

  const weekDates = useMemo(() => {
    const startOfWeek = getStartOfWeekMonday(today);

    return DAYS.map((_, index) => {
      return addDays(startOfWeek, index);
    });
  }, [today]);

  const activeRoutines = useMemo(() => {
    return routines.filter(isRoutineVisibleInTimetable);
  }, [routines]);

  const endedRoutines = useMemo(() => {
    return routines.filter((routine) => {
      return routine.isActive === false || isRoutineEnded(routine);
    });
  }, [routines]);

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

  function refreshTravelData() {
    setSavedPlaces(getSavedPlaces());
    setTravelTimeRules(getTravelTimeRules());
  }

  function getSavedPlaceByName(nextPlaceName: string) {
    const normalizedPlaceName = nextPlaceName.trim().toLowerCase();

    return savedPlaces.find((place) => {
      return place.name.trim().toLowerCase() === normalizedPlaceName;
    });
  }

  function handlePlaceNameChange(nextPlaceName: string) {
    setPlaceName(nextPlaceName);

    const savedPlace = getSavedPlaceByName(nextPlaceName);

    if (savedPlace) {
      setPlaceAddress(savedPlace.address);
      setPlacePostalCode(savedPlace.postalCode ?? "");
    }
  }

  function saveRoutinePlaceIfNeeded() {
    const trimmedPlaceName = placeName.trim();
    const trimmedAddress = placeAddress.trim();

    if (!trimmedPlaceName || !trimmedAddress) {
      return;
    }

    const now = new Date().toISOString();
    const existingPlace = getSavedPlaceByName(trimmedPlaceName);

    if (existingPlace) {
      updateSavedPlace({
        ...existingPlace,
        name: trimmedPlaceName,
        address: trimmedAddress,
        postalCode: placePostalCode.trim() || undefined,
        updatedAt: now,
      });
      return;
    }

    saveSavedPlace({
      id: createId(),
      name: trimmedPlaceName,
      address: trimmedAddress,
      postalCode: placePostalCode.trim() || undefined,
      memo: "",
      latitude: null,
      longitude: null,
      provider: "daum-postcode",
      providerPlaceId: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      alert("일정 제목을 입력해줘.");
      return;
    }

    if (!placeName.trim()) {
      alert("위치를 입력해줘.");
      return;
    }

    if (!placeAddress.trim()) {
      alert("우편번호 검색으로 실제 주소를 선택해줘.");
      return;
    }

    if (startTime >= endTime) {
      alert("종료 시간은 시작 시간보다 늦어야 해.");
      return;
    }

    if (startDate && endDate && startDate > endDate) {
      alert("종료일은 시작일보다 늦거나 같아야 해.");
      return;
    }

    const now = new Date().toISOString();

    const newRoutine: RoutineSchedule = {
      id: createId(),
      title: title.trim(),
      dayOfWeek,
      startTime,
      endTime,
      placeName: placeName.trim(),
      memo: memo.trim(),
      color,
      startDate: startDate || null,
      endDate: endDate || null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    saveRoutineSchedule(newRoutine);
    saveRoutinePlaceIfNeeded();
    setRoutines(getRoutineSchedules());
    setSavedPlaces(getSavedPlaces());

    setTitle("");
    setDayOfWeek("월");
    setStartTime("09:00");
    setEndTime("10:00");
    setPlaceName("");
    setPlaceAddress("");
    setPlacePostalCode("");
    setMemo("");
    setColor(DEFAULT_ROUTINE_SCHEDULE_COLOR);
    setStartDate("");
    setEndDate("");
    setDragSelection(null);
  }

  function handleDelete(id: string) {
    deleteRoutineSchedule(id);
    setRoutines(getRoutineSchedules());
  }

  function handleRoutineColorChange(routine: RoutineSchedule, nextColor: string) {
    updateRoutineSchedule({
      ...routine,
      color: nextColor,
      updatedAt: new Date().toISOString(),
    });
    setRoutines(getRoutineSchedules());
  }

  function getRoutinesByDayAndDate(day: DayOfWeek, dateText: string) {
    return routines.filter((routine) => {
      return (
        routine.dayOfWeek === day && isRoutineActiveOnDate(routine, dateText)
      );
    });
  }

  function getSingleSchedulesByDateText(dateText: string) {
    return singleSchedules.filter((schedule) => schedule.date === dateText);
  }

  function getDailyScheduleItems(day: DayOfWeek, dateText: string) {
    const routineItems = getRoutinesByDayAndDate(day, dateText).map(
      (routine) => {
        const scheduleColor = getScheduleColor(
          routine.color,
          DEFAULT_ROUTINE_SCHEDULE_COLOR
        );

        return {
          id: `routine-${routine.id}-${dateText}`,
          type: "정기",
          title: routine.title,
          placeName: routine.placeName,
          startTime: routine.startTime,
          endTime: routine.endTime,
          color: scheduleColor,
        };
      }
    );
    const singleItems = getSingleSchedulesByDateText(dateText).map(
      (schedule) => {
        const scheduleColor = getScheduleColor(
          schedule.color,
          DEFAULT_SINGLE_SCHEDULE_COLOR
        );

        return {
          id: `single-${schedule.id}`,
          type: "단기",
          title: schedule.title,
          placeName: schedule.placeName || "위치 미입력",
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          color: scheduleColor,
        };
      }
    );

    return [...routineItems, ...singleItems].sort((a, b) => {
      return a.startTime.localeCompare(b.startTime);
    });
  }

  function handlePointerDown(
    event: PointerEvent<HTMLDivElement>,
    day: DayOfWeek
  ) {
    if (!isEditMode) return;

    const selectedMinutes = getMinutesFromMouse(event, event.currentTarget);

    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
    setDragSelection({
      day,
      startMinutes: selectedMinutes,
      endMinutes: selectedMinutes + SNAP_MINUTES,
    });
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!isDragging || !dragSelection) return;

    const selectedMinutes = getMinutesFromMouse(event, event.currentTarget);

    setDragSelection({
      ...dragSelection,
      endMinutes: selectedMinutes,
    });
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!dragSelection) return;

    event.currentTarget.releasePointerCapture(event.pointerId);
    const normalized = normalizeSelection(dragSelection);

    setIsDragging(false);
    setDragSelection(normalized);

    setDayOfWeek(normalized.day);
    setStartTime(minutesToTime(normalized.startMinutes));
    setEndTime(minutesToTime(normalized.endMinutes));
  }

  function handleMobilePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!isEditMode) return;

    const selectedMinutes = getMinutesFromMouse(
      event,
      event.currentTarget,
      MOBILE_HOUR_HEIGHT
    );

    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
    setDragSelection({
      day: selectedMobileDay,
      startMinutes: selectedMinutes,
      endMinutes: selectedMinutes + SNAP_MINUTES,
    });
  }

  function handleMobilePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!isDragging || !dragSelection) return;

    const selectedMinutes = getMinutesFromMouse(
      event,
      event.currentTarget,
      MOBILE_HOUR_HEIGHT
    );

    setDragSelection({
      ...dragSelection,
      endMinutes: selectedMinutes,
    });
  }

  function handleMobilePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!dragSelection) return;

    event.currentTarget.releasePointerCapture(event.pointerId);
    const normalized = normalizeSelection(dragSelection);

    setIsDragging(false);
    setDragSelection(normalized);

    setDayOfWeek(normalized.day);
    setStartTime(minutesToTime(normalized.startMinutes));
    setEndTime(minutesToTime(normalized.endMinutes));
  }

  const normalizedDragSelection = dragSelection
    ? normalizeSelection(dragSelection)
    : null;
  const selectedMobileIndex = Math.max(
    0,
    weekDates.findIndex((date) => toDateText(date) === selectedMobileDateText)
  );
  const selectedMobileDate = weekDates[selectedMobileIndex] ?? weekDates[0];
  const selectedMobileDay = DAYS[selectedMobileIndex] ?? DAYS[0];
  const selectedMobileItems = getDailyScheduleItems(
    selectedMobileDay,
    toDateText(selectedMobileDate)
  );

  return (
    <section className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900">주간 캘린더</h2>
            <p className="mt-1 text-sm text-slate-500">
              이번 주 날짜를 기준으로 정기 일정과 단기 일정을 함께 보여줍니다.
              편집을 켜면 시간대를 10분 단위로 드래그할 수 있습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsEditMode((current) => !current)}
            className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
              isEditMode
                ? "bg-slate-950 text-white"
                : "bg-blue-50 text-blue-700 ring-1 ring-blue-100"
            }`}
          >
            {isEditMode ? "편집 종료" : "주간 캘린더 편집"}
          </button>
        </div>

        <div className="mt-4 md:hidden">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {DAYS.map((day, index) => {
              const date = weekDates[index];
              const dateText = toDateText(date);
              const dayItems = getDailyScheduleItems(day, dateText);
              const isToday = dateText === toDateText(today);
              const isSelected = dateText === toDateText(selectedMobileDate);
              const densityLabel =
                dayItems.length >= 4
                  ? "바쁨"
                  : dayItems.length >= 2
                  ? "보통"
                  : dayItems.length === 1
                  ? "여유"
                  : "비어있음";

              return (
                <button
                  key={dateText}
                  type="button"
                  onClick={() => setSelectedMobileDateText(dateText)}
                  className={`min-w-[78px] rounded-3xl px-3 py-3 text-left transition ${
                    isSelected
                      ? "bg-slate-950 text-white shadow-[0_14px_28px_rgba(15,23,42,0.18)]"
                      : "bg-slate-50 text-slate-600 ring-1 ring-slate-100"
                  }`}
                >
                  <p className="text-xs font-black opacity-80">
                    {formatMonthDay(date)}
                  </p>
                  <p className="mt-1 text-xl font-black">{day}</p>
                  <p className="mt-2 text-[11px] font-bold opacity-75">
                    {isToday ? "오늘 · " : ""}
                    {densityLabel}
                  </p>
                  <div className="mt-2 flex gap-1">
                    {dayItems.slice(0, 4).map((item) => (
                      <span
                        key={`${dateText}-${item.id}`}
                        className="h-1.5 w-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-[28px] bg-slate-50 p-4 ring-1 ring-slate-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black text-slate-500">
                  {formatMonthDay(selectedMobileDate)} {selectedMobileDay}요일
                </p>
                <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                  하루 시간표
                </h3>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-500 ring-1 ring-slate-100">
                {selectedMobileItems.length}개
              </span>
            </div>

            <div
              onPointerDown={handleMobilePointerDown}
              onPointerMove={handleMobilePointerMove}
              onPointerUp={handleMobilePointerUp}
              onPointerCancel={() => {
                if (isDragging) {
                  setIsDragging(false);
                }
              }}
              className={`relative mt-4 overflow-hidden rounded-3xl bg-white ring-1 ring-slate-100 ${
                isEditMode ? "touch-none" : ""
              }`}
              style={{
                height: `${(END_HOUR - START_HOUR) * MOBILE_HOUR_HEIGHT}px`,
              }}
            >
              <div className="absolute inset-y-0 left-0 w-14 border-r border-slate-100 bg-slate-50">
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="border-b border-slate-100 pr-2 text-right text-[10px] font-bold text-slate-400"
                    style={{ height: `${MOBILE_HOUR_HEIGHT}px` }}
                  >
                    <span className="relative top-[-2px]">
                      {String(hour).padStart(2, "0")}:00
                    </span>
                  </div>
                ))}
              </div>

              <div className="absolute inset-y-0 left-14 right-0">
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="border-b border-slate-100"
                    style={{ height: `${MOBILE_HOUR_HEIGHT}px` }}
                  />
                ))}

                {normalizedDragSelection &&
                  normalizedDragSelection.day === selectedMobileDay && (
                    <div
                      className="pointer-events-none absolute left-2 right-2 z-10 rounded-2xl border border-blue-400 bg-blue-200/70 p-2 text-xs"
                      style={{
                        top: `${
                          ((normalizedDragSelection.startMinutes -
                            START_HOUR * 60) /
                            60) *
                          MOBILE_HOUR_HEIGHT
                        }px`,
                        height: `${Math.max(
                          ((normalizedDragSelection.endMinutes -
                            normalizedDragSelection.startMinutes) /
                            60) *
                            MOBILE_HOUR_HEIGHT,
                          24
                        )}px`,
                      }}
                    >
                      <p className="font-black text-blue-950">선택한 시간</p>
                      <p className="mt-0.5 font-semibold text-blue-800">
                        {minutesToTime(normalizedDragSelection.startMinutes)} ~{" "}
                        {minutesToTime(normalizedDragSelection.endMinutes)}
                      </p>
                    </div>
                  )}

                {selectedMobileItems.map((item) => {
                  const top = getScheduleTop(
                    item.startTime,
                    MOBILE_HOUR_HEIGHT
                  );
                  const height = getScheduleHeight(
                    item.startTime,
                    item.endTime,
                    MOBILE_HOUR_HEIGHT
                  );

                  return (
                    <div
                      key={item.id}
                      className="absolute left-2 right-2 overflow-hidden rounded-2xl border p-3 text-xs"
                      style={{
                        top: `${top}px`,
                        height: `${Math.max(height, 28)}px`,
                        ...getSoftColorStyle(item.color),
                      }}
                    >
                      <div className="flex items-center gap-1">
                        <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-black">
                          {item.type}
                        </span>
                        <p className="truncate font-black">{item.title}</p>
                      </div>
                      <p className="mt-1 truncate font-semibold">
                        {item.startTime} ~ {item.endTime}
                      </p>
                      <p className="mt-0.5 truncate">{item.placeName}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {isEditMode && (
              <p className="mt-3 rounded-2xl bg-blue-50 p-3 text-xs font-bold leading-5 text-blue-700 ring-1 ring-blue-100">
                하루 시간표를 누르고 드래그하면 10분 단위로 시간이 선택되고,
                아래 정기 일정 입력칸에 자동 반영됩니다.
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 hidden max-h-[720px] overflow-auto rounded-3xl border border-slate-100 bg-slate-50 md:block">
          <div className="min-w-[760px] md:min-w-[860px]">
            <div className="sticky top-0 z-20 grid grid-cols-[64px_repeat(7,1fr)] border-b border-slate-200 bg-white">
              <div className="p-3 text-center text-xs font-bold text-slate-400">
                시간
              </div>

              {DAYS.map((day, index) => {
                const date = weekDates[index];
                const dateText = toDateText(date);
                const isToday = dateText === toDateText(today);

                return (
                  <div
                    key={day}
                    className="border-l border-slate-100 p-3 text-center text-sm font-black text-slate-700"
                  >
                    <p>
                      {formatMonthDay(date)} {day}
                    </p>

                    {isToday && (
                      <p className="mt-1 text-xs font-bold text-emerald-600">
                        오늘
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div
              className="relative grid select-none grid-cols-[64px_repeat(7,1fr)]"
              style={{
                height: `${(END_HOUR - START_HOUR) * HOUR_HEIGHT}px`,
              }}
            >
              <div className="relative bg-white">
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="border-b border-slate-100 pr-2 text-right text-xs font-semibold text-slate-400"
                    style={{ height: `${HOUR_HEIGHT}px` }}
                  >
                    <span className="relative top-[-2px]">
                      {String(hour).padStart(2, "0")}:00
                    </span>
                  </div>
                ))}
              </div>

              {DAYS.map((day, index) => {
                const date = weekDates[index];
                const dateText = toDateText(date);

                const routinesForDate = getRoutinesByDayAndDate(day, dateText);
                const singleSchedulesForDate =
                  getSingleSchedulesByDateText(dateText);

                return (
                  <div
                    key={day}
                    onPointerDown={(event) => handlePointerDown(event, day)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={() => {
                      if (isDragging) {
                        setIsDragging(false);
                      }
                    }}
                    className={`relative border-l border-slate-100 bg-white ${
                      isEditMode ? "cursor-crosshair touch-none" : "cursor-default"
                    }`}
                  >
                    {hours.map((hour) => (
                      <div
                        key={hour}
                        className="border-b border-slate-100 hover:bg-emerald-50/40"
                        style={{ height: `${HOUR_HEIGHT}px` }}
                      />
                    ))}

                    {normalizedDragSelection &&
                      normalizedDragSelection.day === day && (
                        <div
                          className="pointer-events-none absolute left-1 right-1 z-10 rounded-2xl border border-blue-400 bg-blue-200/60 p-2 text-xs"
                          style={{
                            top: `${
                              ((normalizedDragSelection.startMinutes -
                                START_HOUR * 60) /
                                60) *
                              HOUR_HEIGHT
                            }px`,
                            height: `${Math.max(
                              ((normalizedDragSelection.endMinutes -
                                normalizedDragSelection.startMinutes) /
                                60) *
                                HOUR_HEIGHT,
                              28
                            )}px`,
                          }}
                        >
                          <p className="font-black text-blue-950">
                            선택한 시간
                          </p>
                          <p className="mt-0.5 font-semibold text-blue-800">
                            {minutesToTime(
                              normalizedDragSelection.startMinutes
                            )}{" "}
                            ~ {minutesToTime(normalizedDragSelection.endMinutes)}
                          </p>
                        </div>
                      )}

                    {routinesForDate.map((routine) => {
                      const top = getRoutineTop(routine.startTime);
                      const height = getRoutineHeight(
                        routine.startTime,
                        routine.endTime
                      );
                      const scheduleColor = getScheduleColor(
                        routine.color,
                        DEFAULT_ROUTINE_SCHEDULE_COLOR
                      );

                      return (
                        <div
                          key={`routine-${routine.id}-${dateText}`}
                          onMouseDown={(event) => event.stopPropagation()}
                          className="absolute left-1 right-1 overflow-hidden rounded-2xl border p-2 text-xs"
                          style={{
                            top: `${top}px`,
                            height: `${Math.max(height, 36)}px`,
                            ...getSoftColorStyle(scheduleColor),
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-black">
                              정기
                            </span>
                            <p className="truncate font-black">
                              {routine.title}
                            </p>
                          </div>

                          <p className="mt-0.5 truncate font-semibold">
                            {routine.startTime} ~ {routine.endTime}
                          </p>
                          <p className="mt-0.5 truncate">
                            {routine.placeName}
                          </p>
                        </div>
                      );
                    })}

                    {singleSchedulesForDate.map((schedule) => {
                      const top = getRoutineTop(schedule.startTime);
                      const height = getRoutineHeight(
                        schedule.startTime,
                        schedule.endTime
                      );
                      const scheduleColor = getScheduleColor(
                        schedule.color,
                        DEFAULT_SINGLE_SCHEDULE_COLOR
                      );

                      return (
                        <div
                          key={`single-${schedule.id}`}
                          onMouseDown={(event) => event.stopPropagation()}
                          className="absolute left-1 right-1 overflow-hidden rounded-2xl border p-2 text-xs"
                          style={{
                            top: `${top}px`,
                            height: `${Math.max(height, 36)}px`,
                            ...getSoftColorStyle(scheduleColor),
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-black">
                              단기
                            </span>
                            <p className="truncate font-black">
                              {schedule.title}
                            </p>
                          </div>

                          <p className="mt-0.5 truncate font-semibold">
                            {schedule.startTime} ~ {schedule.endTime}
                          </p>
                          <p className="mt-0.5 truncate">
                            {schedule.placeName || "위치 미입력"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <WeeklyAvailabilityView
        routines={routines}
        singleSchedules={singleSchedules}
      />

      <TimeTaskSuggestionView
        items={items}
        routines={routines}
        singleSchedules={singleSchedules}
      />

      <section
        id="schedule-manager"
        className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100"
      >
        <div>
          <h2 className="text-lg font-black text-slate-900">나의 일정 관리</h2>
          <p className="mt-1 text-sm text-slate-500">
            반복 일정과 이동 준비를 한 곳에서 관리합니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-bold text-slate-700">
              일정 제목
            </label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="예: 학교, 영어학원, 수영 연습"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-sm font-bold text-slate-700">요일</label>
              <select
                value={dayOfWeek}
                onChange={(event) =>
                  setDayOfWeek(event.target.value as DayOfWeek)
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
              >
                {DAYS.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">시작</label>
              <input
                type="time"
                step={600}
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">종료</label>
              <input
                type="time"
                step={600}
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
              />
            </div>
          </div>

          <ScheduleColorPicker
            label="캘린더 색인"
            value={color}
            onChange={setColor}
          />

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm font-bold text-slate-700">
                시작일
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                종료일
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
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
                  우편번호 검색으로 도로명 주소를 선택하면 이동시간 계산에
                  사용할 장소로 함께 저장됩니다.
                </p>
              </div>
              <div className="w-full md:w-44">
                <PostcodeAddressSearch
                  onSelect={({ address, postalCode, detailHint }) => {
                    setPlaceAddress(address);
                    setPlacePostalCode(postalCode);

                    if (!placeName.trim() && detailHint) {
                      setPlaceName(detailHint.split(",")[0]);
                    }
                  }}
                />
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-[0.8fr_1.2fr]">
              <div>
                <input
                  list="routine-place-options"
                  value={placeName}
                  onChange={(event) =>
                    handlePlaceNameChange(event.target.value)
                  }
                  placeholder="장소 이름: 집, 학교, 영어학원"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400"
                />
                <datalist id="routine-place-options">
                  {placeNameOptions.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>

              <input
                value={placeAddress}
                onChange={(event) => setPlaceAddress(event.target.value)}
                placeholder="우편번호 검색 후 도로명 주소가 들어옵니다"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400"
              />
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-[180px_1fr]">
              <input
                value={placePostalCode}
                onChange={(event) => setPlacePostalCode(event.target.value)}
                placeholder="우편번호"
                inputMode="numeric"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400"
              />
              <p className="rounded-2xl bg-white p-3 text-xs font-bold leading-5 text-slate-500 ring-1 ring-slate-100">
                기존 저장 장소를 선택하면 주소가 자동으로 채워집니다. 새 장소는
                정기 일정 저장 시 저장 장소 목록에도 추가됩니다.
              </p>
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700">메모</label>
            <input
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              placeholder="예: 3월 2일부터 6월 5일까지"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-700"
          >
            정기 일정 저장
          </button>
        </form>

        <div className="mt-6 border-t border-slate-100 pt-6">
          <TravelTimePlanner
            routines={routines}
            singleSchedules={singleSchedules}
            savedPlaces={savedPlaces}
            travelTimeRules={travelTimeRules}
            onChange={refreshTravelData}
          />
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
        <div className="space-y-3">
          <h3 className="text-sm font-black text-slate-800">활성 정기 일정</h3>

          {activeRoutines.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
              현재 활성화된 정기 일정이 없습니다.
            </p>
          ) : (
            activeRoutines.map((routine) => (
              <div
                key={routine.id}
                className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-900">
                      {routine.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {routine.dayOfWeek}요일 {routine.startTime} ~{" "}
                      {routine.endTime}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      위치: {routine.placeName}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      기간: {routine.startDate ?? "제한 없음"} ~{" "}
                      {routine.endDate ?? "제한 없음"}
                    </p>
                    {routine.memo && (
                      <p className="mt-1 text-sm text-slate-500">
                        메모: {routine.memo}
                      </p>
                    )}
                    <div className="mt-3">
                      <ScheduleColorPicker
                        value={getScheduleColor(
                          routine.color,
                          DEFAULT_ROUTINE_SCHEDULE_COLOR
                        )}
                        onChange={(nextColor) =>
                          handleRoutineColorChange(routine, nextColor)
                        }
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(routine.id)}
                    className="shrink-0 rounded-xl bg-white px-3 py-2 text-xs font-bold text-red-500 ring-1 ring-red-100 hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {endedRoutines.length > 0 && (
          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-black text-slate-800">
              종료된 정기 일정
            </h3>

            {endedRoutines.map((routine) => (
              <div
                key={routine.id}
                className="rounded-2xl border border-slate-100 bg-slate-100 p-4 opacity-70"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-700">
                      {routine.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {routine.dayOfWeek}요일 {routine.startTime} ~{" "}
                      {routine.endTime}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      위치: {routine.placeName}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      기간: {routine.startDate ?? "제한 없음"} ~{" "}
                      {routine.endDate ?? "제한 없음"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(routine.id)}
                    className="shrink-0 rounded-xl bg-white px-3 py-2 text-xs font-bold text-red-500 ring-1 ring-red-100 hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

export default RoutineScheduleManager;
