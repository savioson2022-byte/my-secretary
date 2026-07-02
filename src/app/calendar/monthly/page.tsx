"use client";

import { useEffect, useState } from "react";
import BottomNavigation from "@/components/BottomNavigation";
import CalendarNavigation from "@/components/CalendarNavigation";
import MonthlyCalendarView from "@/components/MonthlyCalendarView";
import UserStatusBadge from "@/components/UserStatusBadge";
import {
  getSingleScheduleUpdatedEventName,
  getSingleSchedules,
} from "@/lib/singleScheduleStorage";
import { SingleSchedule } from "@/types/calendar";

export default function MonthlyCalendarPage() {
  const [singleSchedules, setSingleSchedules] = useState<SingleSchedule[]>([]);

  useEffect(() => {
    function refreshSchedules() {
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

  return (
    <main className="mx-auto min-h-screen max-w-[520px] px-4 py-8">
      <div className="phone-shell overflow-hidden p-4">
        <div className="flex items-center justify-between px-1 pb-5 pt-1 text-xs font-black text-slate-900">
          <span>9:41</span>
          <span className="tracking-[0.18em]">•••</span>
        </div>
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-slate-500">캘린더</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              월간 캘린더
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              한 달 단위로 병원, 시험, 약속 같은 단기 일정을 확인합니다.
            </p>
          </div>
          <UserStatusBadge />
        </header>

      <CalendarNavigation />

      <section className="mt-6">
        <MonthlyCalendarView singleSchedules={singleSchedules} />
      </section>
        <BottomNavigation />
      </div>
    </main>
  );
}
