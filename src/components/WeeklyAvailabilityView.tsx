"use client";

import {
  addDays,
  calculateFreeTimeBlocksForDate,
  getDayOfWeekFromDateText,
  getStartOfWeekMonday,
  getTodayDateOnly,
  toDateOnlyString,
} from "@/lib/availability";
import { SingleSchedule } from "@/types/calendar";
import { RoutineSchedule } from "@/types/routine";
import { useState } from "react";

type WeeklyAvailabilityViewProps = {
  routines: RoutineSchedule[];
  singleSchedules: SingleSchedule[];
};

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainMinutes = minutes % 60;

  if (hours === 0) {
    return `${remainMinutes}분`;
  }

  if (remainMinutes === 0) {
    return `${hours}시간`;
  }

  return `${hours}시간 ${remainMinutes}분`;
}

function formatMonthDay(dateText: string) {
  const [, month, day] = dateText.split("-");

  return `${Number(month)}/${Number(day)}`;
}

export default function WeeklyAvailabilityView({
  routines,
  singleSchedules,
}: WeeklyAvailabilityViewProps) {
  const today = getTodayDateOnly();
  const startOfWeek = getStartOfWeekMonday(today);

  const weekDates = Array.from({ length: 7 }, (_, index) => {
    return toDateOnlyString(addDays(startOfWeek, index));
  });
  const [selectedDateText, setSelectedDateText] = useState(() => {
    return toDateOnlyString(today);
  });
  const selectedFreeTimeBlocks = calculateFreeTimeBlocksForDate({
    date: selectedDateText,
    routines,
    singleSchedules,
  });
  const selectedDayOfWeek = getDayOfWeekFromDateText(selectedDateText);

  return (
    <section className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
      <div>
        <h3 className="text-base font-black text-slate-900">
          이번 주 빈 시간
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          정기 일정과 단기 일정을 모두 제외하고 실제로 남는 시간을 계산합니다.
        </p>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {weekDates.map((dateText) => {
          const freeTimeBlocks = calculateFreeTimeBlocksForDate({
            date: dateText,
            routines,
            singleSchedules,
          });

          const dayOfWeek = getDayOfWeekFromDateText(dateText);
          const isToday = dateText === toDateOnlyString(today);
          const isSelected = dateText === selectedDateText;

          return (
            <button
              type="button"
              key={dateText}
              onClick={() => setSelectedDateText(dateText)}
              className={`shrink-0 rounded-2xl border px-4 py-3 text-left transition ${
                isSelected
                  ? "border-blue-200 bg-white text-blue-700 shadow-soft"
                  : "border-slate-100 bg-white text-slate-500"
              }`}
            >
              <p className="text-sm font-black">
                {formatMonthDay(dateText)} {dayOfWeek}
              </p>
              <p className="mt-1 text-xs font-bold">
                {isToday ? "오늘 · " : ""}
                빈 시간 {freeTimeBlocks.length}개
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h4 className="font-black text-slate-800">
            {formatMonthDay(selectedDateText)} {selectedDayOfWeek}
          </h4>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">
            {selectedFreeTimeBlocks.length}개
          </span>
        </div>

        {selectedFreeTimeBlocks.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
            빈 시간이 없습니다.
          </p>
        ) : (
          <ul className="space-y-2">
            {selectedFreeTimeBlocks.map((block) => (
              <li
                key={`${selectedDateText}-${block.startTime}-${block.endTime}`}
                className="rounded-xl bg-slate-50 px-3 py-2 text-sm"
              >
                <p className="font-bold text-slate-800">
                  {block.startTime} ~ {block.endTime}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {formatMinutes(block.minutes)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
