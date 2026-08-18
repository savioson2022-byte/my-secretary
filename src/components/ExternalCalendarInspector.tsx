"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { calculateFreeTimeBlocksForDate } from "@/lib/availability";
import { loadEnabledExternalCalendarEvents } from "@/lib/externalCalendar";
import { EXTERNAL_CALENDAR_SETTINGS_CHANGED_EVENT } from "@/lib/externalCalendarSettings";
import { getRoutineSchedules } from "@/lib/routineStorage";
import { getSingleSchedules } from "@/lib/singleScheduleStorage";
import type { SingleSchedule } from "@/types/calendar";
import type { RoutineSchedule } from "@/types/routine";
import {
  EXTERNAL_CALENDAR_EXCLUSION_LABEL,
  type ExternalCalendarEvent,
} from "@/types/externalCalendar";

/**
 * 연동이 실제로 동작하는지 눈으로 확인하는 진단 화면.
 *
 * 읽어온 일정 하나하나에 어떤 판정이 적용됐는지, 그리고 그 결과로 빈 시간이
 * 얼마나 줄었는지 보여준다. 규칙이 틀렸을 때 어디가 틀렸는지 바로 알 수 있다.
 */

function getTodayText() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const date = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${date}`;
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;

  if (hours === 0) return `${remain}분`;
  if (remain === 0) return `${hours}시간`;

  return `${hours}시간 ${remain}분`;
}

function sumMinutes(blocks: { minutes: number }[]) {
  return blocks.reduce((total, block) => total + block.minutes, 0);
}

export default function ExternalCalendarInspector() {
  const [dateText, setDateText] = useState(getTodayText);
  const [events, setEvents] = useState<ExternalCalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // 렌더 중에 localStorage를 읽으면 서버 렌더 결과와 어긋난다.
  const [routines, setRoutines] = useState<RoutineSchedule[]>([]);
  const [singleSchedules, setSingleSchedules] = useState<SingleSchedule[]>([]);

  useEffect(() => {
    setRoutines(getRoutineSchedules());
    setSingleSchedules(getSingleSchedules());
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    setEvents(
      await loadEnabledExternalCalendarEvents({
        startDate: dateText,
        endDate: dateText,
        includeAppCreated: true,
      })
    );
    setIsLoading(false);
  }, [dateText]);

  useEffect(() => {
    void load();

    const handleChanged = () => void load();
    window.addEventListener(
      EXTERNAL_CALENDAR_SETTINGS_CHANGED_EVENT,
      handleChanged
    );

    return () => {
      window.removeEventListener(
        EXTERNAL_CALENDAR_SETTINGS_CHANGED_EVENT,
        handleChanged
      );
    };
  }, [load]);

  // 앱이 만든 일정은 목록에는 보여주되, 빈 시간 계산에서는 실제 동작과 똑같이 뺀다.
  const countedEvents = useMemo(
    () => events.filter((event) => !event.createdByApp),
    [events]
  );

  const minutesWithout = sumMinutes(
    calculateFreeTimeBlocksForDate({ date: dateText, routines, singleSchedules })
  );
  const minutesWith = sumMinutes(
    calculateFreeTimeBlocksForDate({
      date: dateText,
      routines,
      singleSchedules,
      externalEvents: countedEvents,
    })
  );
  const blockingCount = countedEvents.filter((event) => event.blocksTime).length;

  return (
    <section className="app-card p-5">
      <h3 className="font-black text-slate-900">읽어온 일정 확인</h3>
      <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">
        연동이 제대로 동작하는지 확인하는 화면입니다. 캘린더에서 읽은 일정과, 그
        일정이 빈 시간을 얼마나 줄였는지 보여줍니다.
      </p>

      <label className="mt-4 block">
        <span className="text-xs font-black text-slate-500">날짜</span>
        <input
          type="date"
          value={dateText}
          onChange={(event) => setDateText(event.target.value)}
          className="mt-1 min-h-11 w-full rounded-2xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900 ring-1 ring-slate-100"
        />
      </label>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-slate-50 p-3 text-center ring-1 ring-slate-100">
          <p className="text-[11px] font-black text-slate-400">연동 전 빈 시간</p>
          <p className="mt-1 text-sm font-black text-slate-900">
            {formatMinutes(minutesWithout)}
          </p>
        </div>
        <div className="rounded-2xl bg-blue-50 p-3 text-center ring-1 ring-blue-100">
          <p className="text-[11px] font-black text-blue-500">연동 후 빈 시간</p>
          <p className="mt-1 text-sm font-black text-blue-700">
            {formatMinutes(minutesWith)}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3 text-center ring-1 ring-slate-100">
          <p className="text-[11px] font-black text-slate-400">줄어든 시간</p>
          <p className="mt-1 text-sm font-black text-slate-900">
            {formatMinutes(minutesWithout - minutesWith)}
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs font-bold leading-5 text-slate-500">
        {isLoading
          ? "읽는 중..."
          : `일정 ${events.length}개를 읽었고, 그중 ${blockingCount}개가 시간을 점유합니다.`}
      </p>

      {!isLoading && events.length === 0 && (
        <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-xs font-bold leading-5 text-slate-500">
          이 날짜에 읽어온 일정이 없습니다. 연동이 꺼져 있거나, 캘린더를 모두
          꺼뒀거나, 실제로 일정이 없는 경우입니다.
        </p>
      )}

      {events.length > 0 && (
        <ul className="mt-3 space-y-2">
          {events.map((event) => (
            <li
              key={event.externalId}
              className={`rounded-2xl p-3 ring-1 ${
                event.blocksTime
                  ? "bg-white ring-slate-200"
                  : "bg-slate-50 ring-slate-100"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p
                  className={`min-w-0 flex-1 truncate text-sm font-black ${
                    event.blocksTime ? "text-slate-900" : "text-slate-400"
                  }`}
                >
                  {event.title}
                </p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${
                    event.blocksTime
                      ? "bg-blue-50 text-blue-700"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {event.blocksTime ? "시간 점유" : "제외됨"}
                </span>
              </div>

              <p className="mt-1 font-mono text-[11px] font-bold text-slate-500">
                {event.isAllDay
                  ? "종일"
                  : `${event.startTime} – ${event.endTime}`}
                {event.placeName ? ` · ${event.placeName}` : ""}
              </p>

              {!event.blocksTime && event.exclusionReason && (
                <p className="mt-1 text-[11px] font-bold text-amber-700">
                  제외 사유: {
                    EXTERNAL_CALENDAR_EXCLUSION_LABEL[event.exclusionReason]
                  }
                </p>
              )}

              {event.createdByApp && (
                <p className="mt-1 text-[11px] font-bold text-emerald-700">
                  이 앱이 만든 일정 (중복 계산하지 않음)
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
