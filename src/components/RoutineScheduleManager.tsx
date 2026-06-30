"use client";

import TimeTaskSuggestionView from "@/components/TimeTaskSuggestionView";
import WeeklyAvailabilityView from "@/components/WeeklyAvailabilityView";
import {
  deleteRoutineSchedule,
  getRoutineSchedules,
  saveRoutineSchedule,
} from "@/lib/routineStorage";
import {
  getSingleScheduleUpdatedEventName,
  getSingleSchedules,
} from "@/lib/singleScheduleStorage";
import { AssistantItem } from "@/types/assistant";
import { SingleSchedule } from "@/types/calendar";
import { DayOfWeek, RoutineSchedule } from "@/types/routine";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent, MouseEvent } from "react";

const DAYS: DayOfWeek[] = ["월", "화", "수", "목", "금", "토", "일"];

const START_HOUR = 0;
const END_HOUR = 24;
const HOUR_HEIGHT = 56;
const SNAP_MINUTES = 30;

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
  return new Date().toISOString().slice(0, 10);
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

function getMinutesFromMouse(
  event: MouseEvent<HTMLDivElement>,
  element: HTMLDivElement
) {
  const rect = element.getBoundingClientRect();
  const y = event.clientY - rect.top;

  const minutesFromStart = (y / HOUR_HEIGHT) * 60;
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

  const [title, setTitle] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>("월");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [placeName, setPlaceName] = useState("");
  const [memo, setMemo] = useState("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [dragSelection, setDragSelection] = useState<DragSelection | null>(
    null
  );
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    function refreshSchedules() {
      setRoutines(getRoutineSchedules());
      setSingleSchedules(getSingleSchedules());
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
      startDate: startDate || null,
      endDate: endDate || null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    saveRoutineSchedule(newRoutine);
    setRoutines(getRoutineSchedules());

    setTitle("");
    setDayOfWeek("월");
    setStartTime("09:00");
    setEndTime("10:00");
    setPlaceName("");
    setMemo("");
    setStartDate("");
    setEndDate("");
    setDragSelection(null);
  }

  function handleDelete(id: string) {
    deleteRoutineSchedule(id);
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

  function handleMouseDown(
    event: MouseEvent<HTMLDivElement>,
    day: DayOfWeek
  ) {
    const selectedMinutes = getMinutesFromMouse(event, event.currentTarget);

    setIsDragging(true);
    setDragSelection({
      day,
      startMinutes: selectedMinutes,
      endMinutes: selectedMinutes + SNAP_MINUTES,
    });
  }

  function handleMouseMove(event: MouseEvent<HTMLDivElement>) {
    if (!isDragging || !dragSelection) return;

    const selectedMinutes = getMinutesFromMouse(event, event.currentTarget);

    setDragSelection({
      ...dragSelection,
      endMinutes: selectedMinutes,
    });
  }

  function handleMouseUp() {
    if (!dragSelection) return;

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

  return (
    <section className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
        <div>
          <h2 className="text-lg font-black text-slate-900">주간 캘린더</h2>
          <p className="mt-1 text-sm text-slate-500">
            이번 주 날짜를 기준으로 정기 일정과 단기 일정을 함께 보여줍니다.
            시간대를 드래그하면 정기 일정 입력 폼에 자동으로 반영됩니다.
          </p>
        </div>

        <div className="mt-4 max-h-[720px] overflow-auto rounded-3xl border border-slate-100 bg-slate-50">
          <div className="min-w-[860px]">
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
                    onMouseDown={(event) => handleMouseDown(event, day)}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={() => {
                      if (isDragging) {
                        setIsDragging(false);
                      }
                    }}
                    className="relative cursor-crosshair border-l border-slate-100 bg-white"
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
                          className="pointer-events-none absolute left-1 right-1 z-10 rounded-2xl border border-emerald-400 bg-emerald-200/60 p-2 text-xs"
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
                          <p className="font-black text-emerald-950">
                            선택한 시간
                          </p>
                          <p className="mt-0.5 font-semibold text-emerald-800">
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

                      return (
                        <div
                          key={`routine-${routine.id}-${dateText}`}
                          onMouseDown={(event) => event.stopPropagation()}
                          className="absolute left-1 right-1 overflow-hidden rounded-2xl bg-emerald-100 p-2 text-xs ring-1 ring-emerald-200"
                          style={{
                            top: `${top}px`,
                            height: `${Math.max(height, 36)}px`,
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <span className="rounded-full bg-emerald-200 px-1.5 py-0.5 text-[10px] font-black text-emerald-800">
                              정기
                            </span>
                            <p className="truncate font-black text-emerald-950">
                              {routine.title}
                            </p>
                          </div>

                          <p className="mt-0.5 truncate font-semibold text-emerald-800">
                            {routine.startTime} ~ {routine.endTime}
                          </p>
                          <p className="mt-0.5 truncate text-emerald-700">
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

                      return (
                        <div
                          key={`single-${schedule.id}`}
                          onMouseDown={(event) => event.stopPropagation()}
                          className="absolute left-1 right-1 overflow-hidden rounded-2xl bg-sky-100 p-2 text-xs ring-1 ring-sky-200"
                          style={{
                            top: `${top}px`,
                            height: `${Math.max(height, 36)}px`,
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <span className="rounded-full bg-sky-200 px-1.5 py-0.5 text-[10px] font-black text-sky-800">
                              단기
                            </span>
                            <p className="truncate font-black text-sky-950">
                              {schedule.title}
                            </p>
                          </div>

                          <p className="mt-0.5 truncate font-semibold text-sky-800">
                            {schedule.startTime} ~ {schedule.endTime}
                          </p>
                          <p className="mt-0.5 truncate text-sky-700">
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

      <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
        <div>
          <h2 className="text-lg font-black text-slate-900">정기 일정 입력</h2>
          <p className="mt-1 text-sm text-slate-500">
            학교, 학원, 운동처럼 반복되는 고정 일정을 입력합니다.
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

          <div className="grid grid-cols-3 gap-3">
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
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">종료</label>
              <input
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
              />
            </div>
          </div>

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

          <div>
            <label className="text-sm font-bold text-slate-700">위치</label>
            <input
              value={placeName}
              onChange={(event) => setPlaceName(event.target.value)}
              placeholder="예: 학교, 영어학원, 집, 수영장"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
            />
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