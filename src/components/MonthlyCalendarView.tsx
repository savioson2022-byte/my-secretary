"use client";

import { SingleSchedule } from "@/types/calendar";
import { useMemo, useState } from "react";

type MonthlyCalendarViewProps = {
  singleSchedules: SingleSchedule[];
};

const WEEK_DAYS = ["월", "화", "수", "목", "금", "토", "일"];

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
  const mondayBasedStartOffset = firstDay === 0 ? -6 : 1 - firstDay;

  const startDate = new Date(firstDateOfMonth);
  startDate.setDate(firstDateOfMonth.getDate() + mondayBasedStartOffset);

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

export default function MonthlyCalendarView({
  singleSchedules,
}: MonthlyCalendarViewProps) {
  const today = useMemo(() => getTodayDateOnly(), []);
  const [currentMonth, setCurrentMonth] = useState(() => {
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const calendarDates = useMemo(() => {
    return getCalendarDates(currentMonth);
  }, [currentMonth]);

  function getSchedulesByDate(dateText: string) {
    return singleSchedules
      .filter((schedule) => schedule.date === dateText)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  return (
    <section className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-base font-black text-slate-900">
            월간 캘린더
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            한 달 단위로 단기 일정, 시험, 약속, 병원 같은 이벤트를 확인합니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
            className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            이전 달
          </button>

          <p className="min-w-[110px] text-center text-sm font-black text-slate-900">
            {getMonthTitle(currentMonth)}
          </p>

          <button
            type="button"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            다음 달
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white">
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
          {WEEK_DAYS.map((day) => (
            <div
              key={day}
              className="p-3 text-center text-xs font-black text-slate-500"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {calendarDates.map((date) => {
            const dateText = toDateText(date);
            const schedules = getSchedulesByDate(dateText);
            const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
            const isToday = dateText === toDateText(today);

            return (
              <div
                key={dateText}
                className={
                  isCurrentMonth
                    ? "min-h-[112px] border-b border-r border-slate-100 p-2"
                    : "min-h-[112px] border-b border-r border-slate-100 bg-slate-50 p-2 opacity-50"
                }
              >
                <div className="flex items-center justify-between">
                  <span
                    className={
                      isToday
                        ? "flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-white"
                        : "text-xs font-black text-slate-700"
                    }
                  >
                    {date.getDate()}
                  </span>

                  {schedules.length > 0 && (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-black text-sky-700">
                      {schedules.length}
                    </span>
                  )}
                </div>

                <div className="mt-2 space-y-1">
                  {schedules.slice(0, 3).map((schedule) => (
                    <div
                      key={schedule.id}
                      className="truncate rounded-lg bg-sky-50 px-2 py-1 text-[11px] font-bold text-sky-800 ring-1 ring-sky-100"
                    >
                      {schedule.startTime} {schedule.title}
                    </div>
                  ))}

                  {schedules.length > 3 && (
                    <p className="px-1 text-[11px] font-bold text-slate-400">
                      +{schedules.length - 3}개 더
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}