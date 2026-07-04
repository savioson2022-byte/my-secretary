"use client";

import ScheduleColorPicker from "@/components/ScheduleColorPicker";
import {
  DEFAULT_ROUTINE_SCHEDULE_COLOR,
  DEFAULT_SINGLE_SCHEDULE_COLOR,
  getScheduleColor,
  getSoftColorStyle,
} from "@/lib/scheduleColors";
import { updateRoutineSchedule } from "@/lib/routineStorage";
import { updateSingleSchedule } from "@/lib/singleScheduleStorage";
import { SingleSchedule } from "@/types/calendar";
import { DayOfWeek, RoutineSchedule } from "@/types/routine";
import { useMemo, useState } from "react";

type MonthlyCalendarViewProps = {
  singleSchedules: SingleSchedule[];
  routineSchedules: RoutineSchedule[];
  onChange?: () => void;
};

const WEEK_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

function getTodayDateOnly() {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function toDateText(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function getMonthTitle(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function getCalendarDates(monthDate: Date) {
  const firstDateOfMonth = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth(),
    1
  );

  const lastDateOfMonth = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1,
    0
  );

  const firstDay = firstDateOfMonth.getDay();
  const sundayBasedStartOffset = -firstDay;

  const startDate = new Date(firstDateOfMonth);
  startDate.setDate(firstDateOfMonth.getDate() + sundayBasedStartOffset);

  const dates: Date[] = [];

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    dates.push(date);
  }

  const lastVisibleDate = dates[dates.length - 1];

  if (lastVisibleDate < lastDateOfMonth) {
    for (let index = 42; index < 49; index += 1) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      dates.push(date);
    }
  }

  return dates;
}

function getDayOfWeek(date: Date): DayOfWeek {
  return ["일", "월", "화", "수", "목", "금", "토"][
    date.getDay()
  ] as DayOfWeek;
}

function isRoutineActiveOnDate(routine: RoutineSchedule, dateText: string) {
  if (routine.isActive === false) return false;
  if (routine.startDate && routine.startDate > dateText) return false;
  if (routine.endDate && routine.endDate < dateText) return false;

  return true;
}

function getReadableDate(dateText: string) {
  const [, month, day] = dateText.split("-");

  return `${Number(month)}.${Number(day)}`;
}

export default function MonthlyCalendarView({
  singleSchedules,
  routineSchedules,
  onChange,
}: MonthlyCalendarViewProps) {
  const today = useMemo(() => getTodayDateOnly(), []);
  const [currentMonth, setCurrentMonth] = useState(() => {
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDateText, setSelectedDateText] = useState(() =>
    toDateText(today)
  );
  const [visibleRoutineIds, setVisibleRoutineIds] = useState<string[]>([]);

  const calendarDates = useMemo(() => {
    return getCalendarDates(currentMonth);
  }, [currentMonth]);

  const activeRoutineSchedules = useMemo(() => {
    return routineSchedules.filter((routine) => routine.isActive !== false);
  }, [routineSchedules]);

  function getSchedulesByDate(dateText: string) {
    return singleSchedules
      .filter((schedule) => schedule.date === dateText)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  function getRoutinesByDate(date: Date) {
    const dateText = toDateText(date);
    const dayOfWeek = getDayOfWeek(date);

    return routineSchedules
      .filter((routine) => {
        return (
          visibleRoutineIds.includes(routine.id) &&
          routine.dayOfWeek === dayOfWeek &&
          isRoutineActiveOnDate(routine, dateText)
        );
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  function getEventsByDate(date: Date) {
    const dateText = toDateText(date);

    return [
      ...getSchedulesByDate(dateText).map((schedule) => ({
        id: schedule.id,
        sourceType: "single" as const,
        title: schedule.title,
        startTime: schedule.startTime,
        color: getScheduleColor(schedule.color, DEFAULT_SINGLE_SCHEDULE_COLOR),
        original: schedule,
      })),
      ...getRoutinesByDate(date).map((routine) => ({
        id: routine.id,
        sourceType: "routine" as const,
        title: routine.title,
        startTime: routine.startTime,
        color: getScheduleColor(routine.color, DEFAULT_ROUTINE_SCHEDULE_COLOR),
        original: routine,
      })),
    ].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  function toggleRoutineVisible(id: string) {
    setVisibleRoutineIds((currentIds) => {
      if (currentIds.includes(id)) {
        return currentIds.filter((currentId) => currentId !== id);
      }

      return [...currentIds, id];
    });
  }

  function updateSingleColor(schedule: SingleSchedule, color: string) {
    updateSingleSchedule({
      ...schedule,
      color,
      updatedAt: new Date().toISOString(),
    });
    onChange?.();
  }

  function updateRoutineColor(routine: RoutineSchedule, color: string) {
    updateRoutineSchedule({
      ...routine,
      color,
      updatedAt: new Date().toISOString(),
    });
    onChange?.();
  }

  const selectedDate = useMemo(() => {
    return new Date(`${selectedDateText}T00:00:00`);
  }, [selectedDateText]);

  const selectedEvents = useMemo(() => {
    return getEventsByDate(selectedDate);
  }, [selectedDate, singleSchedules, routineSchedules, visibleRoutineIds]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2 px-1">
        <button
          type="button"
          onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
          className="grid h-11 w-11 place-items-center rounded-full bg-white text-2xl font-black text-slate-900 ring-1 ring-slate-100"
          aria-label="이전 달"
        >
          ‹
        </button>

        <button
          type="button"
          onClick={() => {
            const nextToday = getTodayDateOnly();
            setCurrentMonth(
              new Date(nextToday.getFullYear(), nextToday.getMonth(), 1)
            );
            setSelectedDateText(toDateText(nextToday));
          }}
          className="rounded-full bg-white px-4 py-2 text-xs font-black text-blue-600 ring-1 ring-blue-100"
        >
          오늘
        </button>

        <h2 className="min-w-0 flex-1 text-center text-2xl font-black text-slate-950">
          {getMonthTitle(currentMonth)}
        </h2>

        <button
          type="button"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="grid h-11 w-11 place-items-center rounded-full bg-white text-2xl font-black text-slate-900 ring-1 ring-slate-100"
          aria-label="다음 달"
        >
          ›
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          onClick={() =>
            setVisibleRoutineIds(activeRoutineSchedules.map((routine) => routine.id))
          }
          className="shrink-0 rounded-full bg-white px-3 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-100"
        >
          정기 전체
        </button>
        {activeRoutineSchedules.map((routine) => {
          const color = getScheduleColor(
            routine.color,
            DEFAULT_ROUTINE_SCHEDULE_COLOR
          );
          const isSelected = visibleRoutineIds.includes(routine.id);

          return (
            <button
              key={routine.id}
              type="button"
              onClick={() => toggleRoutineVisible(routine.id)}
              className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-xs font-black ring-1 ${
                isSelected
                  ? "bg-white text-slate-900 ring-slate-200"
                  : "bg-slate-50 text-slate-400 ring-slate-100"
              }`}
            >
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              {routine.title}
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-[28px] border border-slate-100 bg-white">
        <div className="grid grid-cols-7 border-b border-slate-100 bg-white">
          {WEEK_DAYS.map((day) => (
            <div
              key={day}
              className={`p-3 text-center text-sm font-black ${
                day === "일"
                  ? "text-orange-600"
                  : day === "토"
                    ? "text-blue-600"
                    : "text-slate-500"
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {calendarDates.map((date) => {
            const dateText = toDateText(date);
            const events = getEventsByDate(date);
            const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
            const isToday = dateText === toDateText(today);
            const isSelected = dateText === selectedDateText;

            return (
              <button
                type="button"
                key={dateText}
                onClick={() => setSelectedDateText(dateText)}
                className={`min-h-[104px] border-b border-r border-slate-100 p-1.5 text-left transition sm:min-h-[128px] ${
                  isCurrentMonth ? "bg-white" : "bg-slate-50 text-slate-300"
                } ${isSelected ? "shadow-[inset_0_0_0_2px_rgba(49,130,246,0.22)]" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={
                      isToday
                        ? "flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-white"
                        : `px-1 text-lg font-black ${
                            date.getDay() === 0
                              ? "text-orange-600"
                              : date.getDay() === 6
                                ? "text-blue-600"
                                : "text-slate-800"
                          }`
                    }
                  >
                    {date.getDate()}
                  </span>
                </div>

                <div className="mt-2 space-y-1">
                  {events.slice(0, 3).map((event) => (
                    <div
                      key={`${event.sourceType}-${event.id}`}
                      className="truncate rounded-md border px-1.5 py-1 text-[10px] font-black"
                      style={getSoftColorStyle(event.color)}
                    >
                      {event.startTime} {event.title}
                    </div>
                  ))}

                  {events.length > 3 && (
                    <p className="px-1 text-[10px] font-black text-slate-400">
                      +{events.length - 3}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <section className="rounded-[28px] bg-white p-4 shadow-soft ring-1 ring-slate-100">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-slate-950">
              {getReadableDate(selectedDateText)} 일정
            </h3>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              색인을 바꾸면 월간과 주간 캘린더가 함께 바뀝니다.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
            {selectedEvents.length}개
          </span>
        </div>

        {selectedEvents.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
            선택한 날짜에 표시할 일정이 없습니다.
          </p>
        ) : (
          <div className="space-y-3">
            {selectedEvents.map((event) => (
              <article
                key={`${event.sourceType}-detail-${event.id}`}
                className="rounded-2xl border border-slate-100 bg-slate-50 p-3"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="mt-1 h-4 w-4 shrink-0 rounded-full"
                    style={{ backgroundColor: event.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-900">
                      {event.title}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {event.sourceType === "routine" ? "정기" : "단기"} ·{" "}
                      {event.startTime}
                    </p>
                    <div className="mt-3">
                      <ScheduleColorPicker
                        value={event.color}
                        onChange={(color) => {
                          if (event.sourceType === "single") {
                            updateSingleColor(
                              event.original as SingleSchedule,
                              color
                            );
                          } else {
                            updateRoutineColor(
                              event.original as RoutineSchedule,
                              color
                            );
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
