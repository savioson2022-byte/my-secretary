"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getLocalDataUpdatedEventName } from "@/lib/localStorageRepository";
import {
  createId,
  findMatchingPurchaseHistory,
  getPurchaseHistories,
  savePurchaseHistory,
  updatePurchaseHistory,
} from "@/lib/purchaseHistoryStorage";
import { updateItem } from "@/lib/storage";
import type { AssistantItem } from "@/types/assistant";
import type { PurchaseHistoryItem } from "@/types/purchaseHistory";

type AgentActionSuggestionViewProps = {
  items: AssistantItem[];
  compact?: boolean;
  maxItems?: number;
};

function getActionLabel(item: AssistantItem) {
  if (item.processType === "에이전트위임" && item.actionType === "구매") {
    return "구매 위임";
  }

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

function extractPurchaseProductName(item: AssistantItem) {
  if (item.purchaseProductName?.trim()) {
    return item.purchaseProductName.trim();
  }

  const cleanedText = item.originalText
    .replace(/쿠팡에서|쿠팡|로켓배송|주문해줘|주문|구매해줘|구매|결제|사줘|사야|시켜줘|시켜|좀|해줘|필요해|떨어졌어|다 떨어졌어/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleanedText || item.title;
}

function createCoupangSearchUrl(productName: string) {
  return `https://www.coupang.com/np/search?q=${encodeURIComponent(
    productName
  )}`;
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
  const [purchaseHistories, setPurchaseHistories] = useState<
    PurchaseHistoryItem[]
  >([]);
  const agentItems = items.filter((item) => {
    return (
      item.status === "미완료" &&
      (item.processType === "에이전트위임" ||
        item.actionType === "구매" ||
        item.actionType === "예약")
    );
  });
  const visibleItems =
    typeof maxItems === "number" ? agentItems.slice(0, maxItems) : agentItems;

  useEffect(() => {
    function refreshPurchaseHistories() {
      setPurchaseHistories(getPurchaseHistories());
    }

    refreshPurchaseHistories();
    window.addEventListener(
      getLocalDataUpdatedEventName(),
      refreshPurchaseHistories
    );

    return () => {
      window.removeEventListener(
        getLocalDataUpdatedEventName(),
        refreshPurchaseHistories
      );
    };
  }, []);

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

  function quickHold(item: AssistantItem) {
    updateItem({
      ...item,
      status: "보류",
      updatedAt: new Date().toISOString(),
    });
    setMessage("에이전트 준비 항목을 보류해뒀어.");
  }

  function upsertPurchaseHistory({
    item,
    enableAutomation,
    matchedHistory,
  }: {
    item: AssistantItem;
    enableAutomation: boolean;
    matchedHistory: PurchaseHistoryItem | null;
  }) {
    const now = new Date().toISOString();
    const productName = extractPurchaseProductName(item);

    if (matchedHistory) {
      updatePurchaseHistory({
        ...matchedHistory,
        productName,
        platform: "coupang",
        autoRepurchaseEnabled:
          matchedHistory.autoRepurchaseEnabled || enableAutomation,
        lastPurchasedAt: now,
        updatedAt: now,
      });
    } else {
      savePurchaseHistory({
        id: createId(),
        productName,
        platform: "coupang",
        productUrl: createCoupangSearchUrl(productName),
        defaultQuantity: null,
        maxBudgetKrw: null,
        autoRepurchaseEnabled: enableAutomation,
        lastPurchasedAt: now,
        memo: "나의 비서 구매 위임에서 등록됨",
        createdAt: now,
        updatedAt: now,
      });
    }

    setPurchaseHistories(getPurchaseHistories());
  }

  function markPurchaseComplete(
    item: AssistantItem,
    matchedHistory: PurchaseHistoryItem | null
  ) {
    upsertPurchaseHistory({
      item,
      enableAutomation: true,
      matchedHistory,
    });
    quickConfirm(item);
    setMessage("구매 완료로 기록했고, 다음부터 재구매 자동화 후보로 사용할게.");
  }

  function enableRepurchaseAutomation(
    item: AssistantItem,
    matchedHistory: PurchaseHistoryItem | null
  ) {
    upsertPurchaseHistory({
      item,
      enableAutomation: true,
      matchedHistory,
    });
    setMessage("이 상품은 다음부터 재구매 자동화 후보로 표시할게.");
  }

  function PurchaseDelegationPanel({ item }: { item: AssistantItem }) {
    if (item.actionType !== "구매") return null;

    const productName = extractPurchaseProductName(item);
    const matchedHistory = findMatchingPurchaseHistory(
      productName,
      purchaseHistories
    );
    const canAutomate = Boolean(
      matchedHistory?.autoRepurchaseEnabled &&
        matchedHistory.platform === "coupang"
    );
    const searchUrl =
      matchedHistory?.productUrl || createCoupangSearchUrl(productName);

    return (
      <div className="mt-3 rounded-2xl bg-white p-3 ring-1 ring-violet-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black text-violet-600">쿠팡 구매 위임</p>
            <p className="mt-1 truncate text-sm font-black text-slate-900">
              {productName}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${
              canAutomate
                ? "bg-emerald-50 text-emerald-600"
                : matchedHistory
                  ? "bg-amber-50 text-amber-600"
                  : "bg-slate-100 text-slate-500"
            }`}
          >
            {canAutomate
              ? "재구매 가능"
              : matchedHistory
                ? "이력 있음"
                : "첫 구매"}
          </span>
        </div>
        <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
          {canAutomate
            ? "이미 구매한 상품이라 재구매 후보로 열 수 있어요. 결제는 쿠팡에서 최종 확인해 주세요."
            : matchedHistory
              ? "구매 이력은 있지만 자동화 허용이 꺼져 있어요."
              : "처음 사는 상품은 자동화하지 않고 쿠팡 검색까지만 도와줘요."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={searchUrl}
            target="_blank"
            rel="noreferrer"
            className={`rounded-full px-3 py-1.5 text-xs font-black text-white ${
              canAutomate ? "bg-emerald-600" : "bg-violet-600"
            }`}
          >
            {canAutomate ? "재구매 열기" : "쿠팡에서 찾기"}
          </a>
          {matchedHistory && !canAutomate && (
            <button
              type="button"
              onClick={() => enableRepurchaseAutomation(item, matchedHistory)}
              className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-violet-600 ring-1 ring-violet-100"
            >
              재구매 허용
            </button>
          )}
          {!matchedHistory && (
            <button
              type="button"
              onClick={() => enableRepurchaseAutomation(item, null)}
              className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-600 ring-1 ring-slate-100"
            >
              이미 산 적 있음
            </button>
          )}
          <button
            type="button"
            onClick={() => markPurchaseComplete(item, matchedHistory)}
            className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-600 ring-1 ring-slate-100"
          >
            구매 완료
          </button>
          <Link
            href="/purchase"
            className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-600 ring-1 ring-slate-100"
          >
            자동화 설정
          </Link>
        </div>
      </div>
    );
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
            <PurchaseDelegationPanel item={item} />
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
                    : quickHold(item)
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
