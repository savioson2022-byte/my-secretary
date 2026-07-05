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
import { getRoutineSchedules } from "@/lib/routineStorage";
import { SingleSchedule } from "@/types/calendar";
import { RoutineSchedule } from "@/types/routine";

export default function MonthlyCalendarPage() {
  const [singleSchedules, setSingleSchedules] = useState<SingleSchedule[]>([]);
  const [routineSchedules, setRoutineSchedules] = useState<RoutineSchedule[]>(
    []
  );

  function refreshSchedules() {
    setSingleSchedules(getSingleSchedules());
    setRoutineSchedules(getRoutineSchedules());
  }

  useEffect(() => {
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
    <main className="mx-auto min-h-screen max-w-[720px] bg-white px-3 py-4 sm:bg-transparent sm:px-4 sm:py-8">
      <div className="min-h-screen bg-white pb-2 sm:phone-shell sm:min-h-0 sm:overflow-hidden sm:p-4">
        <div className="flex items-center justify-between px-1 pb-5 pt-1 text-xs font-black text-slate-900">
          <span>9:41</span>
        </div>
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-slate-500">캘린더</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">
              월간 캘린더
            </h1>
          </div>
          <UserStatusBadge />
        </header>

      <CalendarNavigation />

      <section className="mt-4">
        <MonthlyCalendarView
          singleSchedules={singleSchedules}
          routineSchedules={routineSchedules}
          onChange={refreshSchedules}
        />
      </section>
        <BottomNavigation />
      </div>
    </main>
  );
}
