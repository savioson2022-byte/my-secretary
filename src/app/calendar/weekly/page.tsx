"use client";

import { useEffect, useState } from "react";
import BottomNavigation from "@/components/BottomNavigation";
import CalendarNavigation from "@/components/CalendarNavigation";
import RoutineScheduleManager from "@/components/RoutineScheduleManager";
import UserStatusBadge from "@/components/UserStatusBadge";
import { getCloudDataSyncedEventName } from "@/lib/dataSyncEvents";
import { getItems } from "@/lib/storage";
import { AssistantItem } from "@/types/assistant";

export default function WeeklyCalendarPage() {
  const [items, setItems] = useState<AssistantItem[]>([]);

  useEffect(() => {
    function refreshItems() {
      setItems(getItems());
    }

    refreshItems();
    window.addEventListener(getCloudDataSyncedEventName(), refreshItems);

    return () => {
      window.removeEventListener(getCloudDataSyncedEventName(), refreshItems);
    };
  }, []);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8">
      <div className="phone-shell overflow-hidden p-4 md:p-6">
        <div className="flex items-center justify-between px-1 pb-5 pt-1 text-xs font-black text-slate-900">
          <span>9:41</span>
        </div>
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-slate-500">캘린더</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              주간 캘린더
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              모바일에서는 이번 주 흐름, 하루 일정, 빈 시간, 추천 배치만
              확인합니다. 자세한 입력과 편집은 관리 탭에서 합니다.
            </p>
          </div>
          <UserStatusBadge />
        </header>

      <CalendarNavigation />

      <section className="mt-6">
        <RoutineScheduleManager items={items} variant="weekly" />
      </section>
        <BottomNavigation />
      </div>
    </main>
  );
}
