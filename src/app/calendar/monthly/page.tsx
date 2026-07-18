"use client";

import { useEffect, useState } from "react";
import BottomNavigation from "@/components/BottomNavigation";
import CalendarNavigation from "@/components/CalendarNavigation";
import MonthlyCalendarView from "@/components/MonthlyCalendarView";
import UserStatusBadge from "@/components/UserStatusBadge";
import { getCloudDataSyncedEventName } from "@/lib/dataSyncEvents";
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
    window.addEventListener(getCloudDataSyncedEventName(), refreshSchedules);

    return () => {
      window.removeEventListener(
        getSingleScheduleUpdatedEventName(),
        refreshSchedules
      );
      window.removeEventListener(
        getCloudDataSyncedEventName(),
        refreshSchedules
      );
    };
  }, []);

  return (
    <main className="app-page mx-auto max-w-[1280px] bg-white px-3 sm:bg-transparent sm:px-4 lg:px-6 lg:pl-[7.5rem]">
      <div className="min-h-screen bg-white pb-2 sm:phone-shell sm:min-h-0 sm:overflow-hidden sm:p-4 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none">
        <div className="flex items-center justify-between px-1 pb-5 pt-1 text-xs font-black text-slate-900 md:hidden">
          <span>9:41</span>
        </div>
        <header className="mb-4 flex items-start justify-between gap-4 md:rounded-3xl md:bg-white md:p-5 md:shadow-soft md:ring-1 md:ring-slate-100">
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
