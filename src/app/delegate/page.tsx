"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AgentActionSuggestionView from "@/components/AgentActionSuggestionView";
import BottomNavigation from "@/components/BottomNavigation";
import UserStatusBadge from "@/components/UserStatusBadge";
import PageHelpButton from "@/components/PageHelpButton";
import ReservationAssistant from "@/components/ReservationAssistant";
import { getCloudDataSyncedEventName } from "@/lib/dataSyncEvents";
import { getLocalDataUpdatedEventName } from "@/lib/localStorageRepository";
import { getItems } from "@/lib/storage";
import type { AssistantItem } from "@/types/assistant";

export default function DelegatePage() {
  const [items, setItems] = useState<AssistantItem[]>([]);

  useEffect(() => {
    function refreshItems() {
      setItems(getItems());
    }

    refreshItems();
    window.addEventListener(getCloudDataSyncedEventName(), refreshItems);
    window.addEventListener(getLocalDataUpdatedEventName(), refreshItems);

    return () => {
      window.removeEventListener(getCloudDataSyncedEventName(), refreshItems);
      window.removeEventListener(getLocalDataUpdatedEventName(), refreshItems);
    };
  }, []);

  return (
    <main className="app-page mx-auto max-w-3xl px-4">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-blue-600">나의 비서</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            위임
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            위임 준비함은 구매와 예약처럼 비서에게 맡긴 일만 모아, 사용자의
            최종 확인 전까지 준비하는 공간입니다.
          </p>
          <p className="mt-2 text-xs font-bold leading-5 text-slate-400">
            홈의 오늘의 작업함은 일정, 기록, 위임을 함께 요약하고, 이 화면은
            위임한 일만 자세히 보여줍니다.
          </p>
        </div>
        <div className="flex items-center gap-2"><PageHelpButton topic="delegate" /><UserStatusBadge /></div>
      </header>

      <section className="mb-5 grid gap-3 sm:grid-cols-2">
        {[
          ["구매 준비", "재구매", "메일에서 찾은 상품을 다시 구매"],
          ["예약 준비", `${items.filter((item) => item.status === "미완료" && item.actionType === "예약").length}개`, "장소 검색부터 캘린더 저장까지"],
        ].map(([title, value, body]) => (
          <div
            key={title}
            className="rounded-3xl bg-white p-4 shadow-soft ring-1 ring-slate-100"
          >
            <p className="text-xs font-black text-slate-400">{title}</p>
            <p className="mt-2 text-xl font-black text-slate-950">{value}</p>
            <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
              {body}
            </p>
          </div>
        ))}
      </section>

      <section className="mb-5">
        <Link
          href="/purchase"
          className="rounded-3xl bg-emerald-50 p-5 ring-1 ring-emerald-100 transition hover:bg-white"
        >
          <p className="text-sm font-black text-emerald-700">구매 준비</p>
          <h2 className="mt-2 text-lg font-black text-slate-950">
            쿠팡 메일에서 재구매 후보 찾기
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            결제 정보는 저장하지 않고, 이미 산 상품을 다시 살 때만 빠르게
            열어줍니다.
          </p>
        </Link>
      </section>

      <ReservationAssistant items={items} />

      <div className="mt-5"><AgentActionSuggestionView items={items} includeReservations={false} /></div>

      <BottomNavigation />
    </main>
  );
}
