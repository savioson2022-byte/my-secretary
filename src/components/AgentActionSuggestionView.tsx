"use client";

import { useState } from "react";
import { updateItem } from "@/lib/storage";
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
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    title: "",
    originalText: "",
    dueDate: "",
    estimatedMinutes: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const agentItems = items.filter((item) => {
    return (
      item.status === "미완료" &&
      (item.actionType === "구매" || item.actionType === "예약")
    );
  });
  const visibleItems =
    typeof maxItems === "number" ? agentItems.slice(0, maxItems) : agentItems;

  function startEdit(item: AssistantItem) {
    setEditingItemId(item.id);
    setDraft({
      title: item.title,
      originalText: item.originalText,
      dueDate: item.dueDate ?? "",
      estimatedMinutes: item.estimatedMinutes
        ? String(item.estimatedMinutes)
        : "",
    });
  }

  function saveDraft(item: AssistantItem, status: AssistantItem["status"]) {
    const estimatedMinutes = Number(draft.estimatedMinutes);

    updateItem({
      ...item,
      title: draft.title.trim() || item.title,
      originalText: draft.originalText.trim() || item.originalText,
      dueDate: draft.dueDate || null,
      estimatedMinutes:
        Number.isFinite(estimatedMinutes) && estimatedMinutes > 0
          ? estimatedMinutes
          : item.estimatedMinutes,
      status,
      updatedAt: new Date().toISOString(),
    });

    setEditingItemId(null);
    setMessage(
      status === "완료"
        ? "확정된 준비 항목으로 저장했어."
        : "잠시 보류 상태로 저장했어."
    );
  }

  function quickConfirm(item: AssistantItem) {
    updateItem({
      ...item,
      status: "완료",
      updatedAt: new Date().toISOString(),
    });
    setMessage("에이전트 준비 항목을 확정했어.");
  }

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
      {message && (
        <p className="mb-3 rounded-2xl bg-violet-50 px-4 py-3 text-sm font-bold text-violet-700 ring-1 ring-violet-100">
          {message}
        </p>
      )}

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
            {editingItemId === item.id && (
              <div className="mt-3 grid gap-2 rounded-2xl bg-white p-3 ring-1 ring-slate-100 sm:grid-cols-2">
                <input
                  value={draft.title}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-violet-400"
                  placeholder="제목"
                />
                <input
                  type="date"
                  value={draft.dueDate}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      dueDate: event.target.value,
                    }))
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-violet-400"
                />
                <input
                  type="number"
                  min="5"
                  step="5"
                  value={draft.estimatedMinutes}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      estimatedMinutes: event.target.value,
                    }))
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-violet-400"
                  placeholder="예상 분"
                />
                <input
                  value={draft.originalText}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      originalText: event.target.value,
                    }))
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-violet-400"
                  placeholder="요청 내용"
                />
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  editingItemId === item.id
                    ? saveDraft(item, "완료")
                    : quickConfirm(item)
                }
                className="rounded-full bg-violet-600 px-3 py-1.5 text-xs font-black text-white"
              >
                확정
              </button>
              <button
                type="button"
                onClick={() => startEdit(item)}
                className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-600 ring-1 ring-slate-100"
              >
                수정
              </button>
              <button
                type="button"
                onClick={() =>
                  editingItemId === item.id
                    ? saveDraft(item, "보류")
                    : updateItem({
                        ...item,
                        status: "보류",
                        updatedAt: new Date().toISOString(),
                      })
                }
                className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-400 ring-1 ring-slate-100"
              >
                보류
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
