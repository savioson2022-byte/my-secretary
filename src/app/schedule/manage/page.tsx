"use client";

import { useEffect, useState } from "react";
import BottomNavigation from "@/components/BottomNavigation";
import RoutineScheduleManager from "@/components/RoutineScheduleManager";
import UserStatusBadge from "@/components/UserStatusBadge";
import { getCloudDataSyncedEventName } from "@/lib/dataSyncEvents";
import { getItems } from "@/lib/storage";
import { AssistantItem } from "@/types/assistant";

export default function ScheduleManagePage() {
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
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-6 pb-24">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-blue-600">나의 비서</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            일정관리
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            정기 일정, 실제 주소, 색인, 기간을 한 곳에서 관리합니다.
          </p>
        </div>
        <UserStatusBadge />
      </header>

      <RoutineScheduleManager items={items} variant="management" />

      <BottomNavigation />
    </main>
  );
}
