"use client";

import { useEffect, useState } from "react";
import BottomNavigation from "@/components/BottomNavigation";
import CalendarNavigation from "@/components/CalendarNavigation";
import SingleScheduleList from "@/components/SingleScheduleList";
import {
  deleteSingleSchedule,
  getSingleScheduleUpdatedEventName,
  getSingleSchedules,
} from "@/lib/singleScheduleStorage";
import { SingleSchedule } from "@/types/calendar";

export default function SingleSchedulePage() {
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

  function handleDeleteSingleSchedule(id: string) {
    deleteSingleSchedule(id);
    setSingleSchedules(getSingleSchedules());
  }

  return (
    <main className="mx-auto min-h-screen max-w-[520px] px-4 py-8">
      <div className="phone-shell overflow-hidden p-4">
        <div className="flex items-center justify-between px-1 pb-5 pt-1 text-xs font-black text-slate-900">
          <span>9:41</span>
          <span className="tracking-[0.18em]">•••</span>
        </div>
      <header className="mb-6">
        <p className="text-sm font-bold text-slate-500">캘린더</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          단기 일정
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          한 번만 발생하는 일정의 날짜, 시간, 위치, 메모를 수정하고 관리합니다.
        </p>
      </header>

      <CalendarNavigation />

      <section className="mt-6">
        <SingleScheduleList
          schedules={singleSchedules}
          onDelete={handleDeleteSingleSchedule}
        />
      </section>
        <BottomNavigation />
      </div>
    </main>
  );
}
