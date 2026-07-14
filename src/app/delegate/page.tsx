"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AgentActionSuggestionView from "@/components/AgentActionSuggestionView";
import BottomNavigation from "@/components/BottomNavigation";
import UserStatusBadge from "@/components/UserStatusBadge";
import { getCloudDataSyncedEventName } from "@/lib/dataSyncEvents";
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

    return () => {
      window.removeEventListener(getCloudDataSyncedEventName(), refreshItems);
    };
  }, []);

  const delegateCount = useMemo(
    () =>
      items.filter(
        (item) =>
          item.processType === "즉시처리" ||
          item.processType === "에이전트위임" ||
          item.actionType === "구매" ||
          item.actionType === "예약"
      ).length,
    [items]
  );

  return (
    <main className="app-page mx-auto max-w-3xl px-4">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-blue-600">나의 비서</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            위임
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            구매, 예약, 재구매처럼 사용자의 확인이 필요한 일을 한곳에 모아
            결제나 예약 직전까지 준비합니다.
          </p>
        </div>
        <UserStatusBadge />
      </header>

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        {[
          ["확인할 일", `${delegateCount}개`, "오늘 바로 결정할 위임 요청"],
          ["구매 준비", "메일 기반", "이미 산 적 있는 상품 재구매"],
          ["일정관리", "상세 입력", "정기/단기 일정 직접 편집"],
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

      <section className="mb-5 grid gap-3 sm:grid-cols-2">
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
        <Link
          href="/schedule/manage"
          className="rounded-3xl bg-blue-50 p-5 ring-1 ring-blue-100 transition hover:bg-white"
        >
          <p className="text-sm font-black text-blue-700">일정관리</p>
          <h2 className="mt-2 text-lg font-black text-slate-950">
            자세한 일정 입력은 여기서
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            정기일정, 단기일정, 장소와 색인을 한 번에 정리합니다.
          </p>
        </Link>
      </section>

      <AgentActionSuggestionView items={items} />

      <BottomNavigation />
    </main>
  );
}
