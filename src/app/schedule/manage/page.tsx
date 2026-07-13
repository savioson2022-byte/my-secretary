"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
    <main className="app-page mx-auto max-w-3xl px-4">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-blue-600">나의 비서</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            일정관리
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            맥북에서는 자세히 입력하고, 모바일에서는 필요한 것만 빠르게
            확인할 수 있도록 일정 데이터를 정리합니다.
          </p>
        </div>
        <UserStatusBadge />
      </header>

      <section className="mb-5 grid gap-3 md:grid-cols-3">
        {[
          {
            title: "모바일",
            body: "홈에서 말하고, 다음 일정과 확인할 일만 봅니다.",
            href: "/",
            action: "홈으로",
          },
          {
            title: "캘린더",
            body: "월간/주간 화면은 보기 전용으로 일정을 빠르게 훑습니다.",
            href: "/calendar/weekly",
            action: "주간 보기",
          },
          {
            title: "상세관리",
            body: "정기일정, 단기일정, 장소, 색인은 이 화면에서 정리합니다.",
            href: "#schedule-manager",
            action: "입력하기",
          },
        ].map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="rounded-3xl bg-white p-4 shadow-soft ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:ring-blue-100"
          >
            <p className="text-xs font-black text-blue-600">{item.title}</p>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-700">
              {item.body}
            </p>
            <p className="mt-3 text-xs font-black text-slate-400">
              {item.action}
            </p>
          </Link>
        ))}
      </section>

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        {[
          ["장소 관리", "자주 가는 장소와 실제 주소", "/places"],
          ["구매 자동화", "이미 산 상품 재구매 후보", "/purchase"],
          ["기본 설정", "로그인, 이동수단, 앱 설치", "/settings"],
        ].map(([title, body, href]) => (
          <Link
            key={title}
            href={href}
            className="rounded-2xl bg-slate-50 p-4 text-left ring-1 ring-slate-100 transition hover:bg-white hover:ring-blue-100"
          >
            <p className="text-sm font-black text-slate-900">{title}</p>
            <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
              {body}
            </p>
          </Link>
        ))}
      </section>

      <RoutineScheduleManager items={items} variant="management" />

      <BottomNavigation />
    </main>
  );
}
