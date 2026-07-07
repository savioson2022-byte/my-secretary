"use client";

import type { AssistantItem } from "@/types/assistant";

type AgentActionSuggestionViewProps = {
  items: AssistantItem[];
  compact?: boolean;
  maxItems?: number;
};

function getActionLabel(item: AssistantItem) {
  if (item.actionType === "구매") return "구매 준비";
  if (item.actionType === "예약") return "예약 준비";
  return "처리 준비";
}

function getActionGuide(item: AssistantItem) {
  if (item.actionType === "구매") {
    return "상품명, 수량, 예산, 배송지 확인이 필요합니다. 실제 결제 전에는 반드시 사용자 확인 단계를 둡니다.";
  }

  if (item.actionType === "예약") {
    return "장소, 가능한 시간대, 인원, 연락처 확인이 필요합니다. 예약 API가 연결되면 후보 시간을 먼저 제안합니다.";
  }

  return "외부 서비스 연결 전까지는 사용자가 확인할 수 있는 준비 항목으로 관리합니다.";
}

export default function AgentActionSuggestionView({
  items,
  compact = false,
  maxItems,
}: AgentActionSuggestionViewProps) {
  const agentItems = items.filter((item) => {
    return (
      item.status === "미완료" &&
      (item.actionType === "구매" || item.actionType === "예약")
    );
  });
  const visibleItems =
    typeof maxItems === "number" ? agentItems.slice(0, maxItems) : agentItems;

  if (agentItems.length === 0) {
    if (compact) return null;

    return (
      <section className="app-card p-5">
        <h2 className="text-lg font-black text-slate-900">에이전트 준비함</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          “쿠팡에서 시켜줘”, “네이버로 예약해줘” 같은 요청이 저장되면 이곳에서
          필요한 확인사항을 모아볼 수 있습니다.
        </p>
      </section>
    );
  }

  return (
    <section className={compact ? "app-card p-4" : "app-card p-5"}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-black text-slate-900">에이전트 준비함</h2>
          {!compact && (
            <p className="mt-1 text-sm leading-6 text-slate-500">
              실제 구매와 예약은 사용자 확인 후 실행하도록 준비합니다.
            </p>
          )}
        </div>
        <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-600">
          {agentItems.length}개
        </span>
      </div>

      <div className="space-y-2">
        {visibleItems.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900">
                  {item.title}
                </p>
                <p className="mt-1 text-xs font-black text-violet-600">
                  {getActionLabel(item)}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-500 ring-1 ring-slate-100">
                확인 필요
              </span>
            </div>
            {!compact && (
              <p className="mt-3 text-sm leading-6 text-slate-500">
                {getActionGuide(item)}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
