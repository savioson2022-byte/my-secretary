"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getLocalDataUpdatedEventName } from "@/lib/localStorageRepository";
import {
  getDueRepurchaseHistories,
  getNextPurchaseDateFromToday,
} from "@/lib/purchaseAutomation";
import {
  createId,
  findMatchingPurchaseHistory,
  getPurchaseHistories,
  savePurchaseHistory,
  updatePurchaseHistory,
} from "@/lib/purchaseHistoryStorage";
import { updateItem } from "@/lib/storage";
import { getUserProfile } from "@/lib/userProfileStorage";
import type { AssistantItem } from "@/types/assistant";
import type { PurchaseHistoryItem } from "@/types/purchaseHistory";
import type { UserProfile } from "@/types/userProfile";
import type {
  ProductSearchPreference,
  ProductSearchResult,
} from "@/types/productSearch";

type AgentActionSuggestionViewProps = {
  items: AssistantItem[];
  compact?: boolean;
  maxItems?: number;
};

type PurchaseAssistantDraft = {
  color: string;
  preference: ProductSearchPreference | "";
  budget: string;
  products: ProductSearchResult[];
  isSearching: boolean;
  searched: boolean;
  error: string | null;
};

const PURCHASE_PREFERENCE_OPTIONS: Array<{
  value: ProductSearchPreference;
  label: string;
}> = [
  { value: "quality", label: "성분/품질" },
  { value: "lowest-price", label: "최저가" },
  { value: "bulk", label: "대용량" },
];

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

function isHairDyeProduct(productName: string) {
  return /(염색약|염모제|헤어컬러|헤어 컬러|새치염색|새치 염색)/.test(
    productName
  );
}

function createPurchaseAssistantDraft(
  history: PurchaseHistoryItem | null
): PurchaseAssistantDraft {
  return {
    color: "",
    preference: history?.autoRepurchaseEnabled ? "quality" : "",
    budget: history?.maxBudgetKrw ? String(history.maxBudgetKrw) : "",
    products: [],
    isSearching: false,
    searched: false,
    error: null,
  };
}

function createCoupangUrlFromHistory(history: PurchaseHistoryItem) {
  return history.productUrl || createCoupangSearchUrl(history.productName);
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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [purchaseAssistantDrafts, setPurchaseAssistantDrafts] = useState<
    Record<string, PurchaseAssistantDraft>
  >({});
  const instantActionEnabled =
    userProfile?.instantActionAutoOpenEnabled ?? true;
  const agentItems = items.filter((item) => {
    return (
      instantActionEnabled &&
      item.status === "미완료" &&
      (item.processType === "에이전트위임" ||
        item.actionType === "구매" ||
        item.actionType === "예약")
    );
  });
  const dueRepurchaseHistories = getDueRepurchaseHistories(
    purchaseHistories,
    maxItems ?? 5
  );
  const visibleItems =
    typeof maxItems === "number" ? agentItems.slice(0, maxItems) : agentItems;

  useEffect(() => {
    function refreshPurchaseHistories() {
      setPurchaseHistories(getPurchaseHistories());
      setUserProfile(getUserProfile());
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

  function postponeRepurchase(history: PurchaseHistoryItem) {
    const nextPurchaseCheckDate =
      getNextPurchaseDateFromToday(history) ?? history.nextPurchaseCheckDate;

    updatePurchaseHistory({
      ...history,
      nextPurchaseCheckDate,
      updatedAt: new Date().toISOString(),
    });
    setPurchaseHistories(getPurchaseHistories());
    setMessage("재구매 확인을 다음 주기로 미뤘어.");
  }

  function completeRepurchase(history: PurchaseHistoryItem) {
    const now = new Date().toISOString();

    updatePurchaseHistory({
      ...history,
      lastPurchasedAt: now,
      nextPurchaseCheckDate:
        getNextPurchaseDateFromToday(history) ?? history.nextPurchaseCheckDate,
      updatedAt: now,
    });
    setPurchaseHistories(getPurchaseHistories());
    setMessage("구매 완료로 기록했고 다음 재구매일을 다시 잡았어.");
  }

  function upsertPurchaseHistory({
    item,
    enableAutomation,
    matchedHistory,
    selectedProduct,
  }: {
    item: AssistantItem;
    enableAutomation: boolean;
    matchedHistory: PurchaseHistoryItem | null;
    selectedProduct?: ProductSearchResult;
  }) {
    const now = new Date().toISOString();
    const productName = extractPurchaseProductName(item);
    const nextProductName = selectedProduct?.title ?? productName;
    const nextProductUrl =
      selectedProduct?.link ?? matchedHistory?.productUrl ?? createCoupangSearchUrl(productName);

    if (matchedHistory) {
      const nextPurchaseCheckDate =
        matchedHistory.nextPurchaseCheckDate ??
        getNextPurchaseDateFromToday(matchedHistory);

      updatePurchaseHistory({
        ...matchedHistory,
        productName: nextProductName,
        platform: "coupang",
        productUrl: nextProductUrl,
        maxBudgetKrw: matchedHistory.maxBudgetKrw,
        nextPurchaseCheckDate,
        autoRepurchaseEnabled:
          matchedHistory.autoRepurchaseEnabled || enableAutomation,
        lastPurchasedAt: now,
        updatedAt: now,
      });
    } else {
      savePurchaseHistory({
        id: createId(),
        productName: nextProductName,
        platform: "coupang",
        productUrl: nextProductUrl,
        defaultQuantity: null,
        maxBudgetKrw: null,
        repeatCycleDays: null,
        nextPurchaseCheckDate: null,
        source: "agent",
        sourceMessageId: null,
        importedAt: null,
        autoRepurchaseEnabled: enableAutomation,
        lastPurchasedAt: now,
        memo: "나의 비서 구매 위임에서 등록됨",
        createdAt: now,
        updatedAt: now,
      });
    }

    setPurchaseHistories(getPurchaseHistories());
  }

  function getAssistantDraft(
    itemId: string,
    matchedHistory: PurchaseHistoryItem | null
  ) {
    return (
      purchaseAssistantDrafts[itemId] ??
      createPurchaseAssistantDraft(matchedHistory)
    );
  }

  function updateAssistantDraft(
    itemId: string,
    nextPartialDraft: Partial<PurchaseAssistantDraft>
  ) {
    setPurchaseAssistantDrafts((current) => ({
      ...current,
      [itemId]: {
        ...(current[itemId] ?? createPurchaseAssistantDraft(null)),
        ...nextPartialDraft,
      },
    }));
  }

  async function searchPurchaseProducts({
    item,
    productName,
    matchedHistory,
  }: {
    item: AssistantItem;
    productName: string;
    matchedHistory: PurchaseHistoryItem | null;
  }) {
    const draft = getAssistantDraft(item.id, matchedHistory);

    if (isHairDyeProduct(productName) && !draft.color.trim()) {
      updateAssistantDraft(item.id, {
        error: "염색약은 색상을 먼저 골라야 정확히 찾을 수 있어요.",
      });
      return;
    }

    updateAssistantDraft(item.id, {
      isSearching: true,
      error: null,
    });

    try {
      const params = new URLSearchParams({
        product: productName,
      });

      if (draft.color.trim()) {
        params.set("color", draft.color.trim());
      }

      if (draft.preference) {
        params.set("preference", draft.preference);
      }

      if (draft.budget.trim()) {
        params.set("budget", draft.budget.trim());
      }

      const response = await fetch(`/api/products/search?${params.toString()}`);

      if (!response.ok) {
        throw new Error("상품 검색에 실패했어요.");
      }

      const data = (await response.json()) as {
        products?: ProductSearchResult[];
        message?: string;
      };

      updateAssistantDraft(item.id, {
        products: data.products ?? [],
        isSearching: false,
        searched: true,
        error: data.message ?? null,
      });
    } catch (error) {
      updateAssistantDraft(item.id, {
        products: [],
        isSearching: false,
        searched: true,
        error:
          error instanceof Error
            ? error.message
            : "상품 검색 중 오류가 생겼어요.",
      });
    }
  }

  function confirmProductCandidate({
    item,
    matchedHistory,
    selectedProduct,
  }: {
    item: AssistantItem;
    matchedHistory: PurchaseHistoryItem | null;
    selectedProduct: ProductSearchResult;
  }) {
    upsertPurchaseHistory({
      item,
      enableAutomation: true,
      matchedHistory,
      selectedProduct,
    });
    setMessage(
      `"${selectedProduct.title}"을 구매 후보로 저장했어. 구매 자동화 페이지에서 실행할 수 있어.`
    );
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
    const assistantDraft = getAssistantDraft(item.id, matchedHistory);
    const needsColor = isHairDyeProduct(productName);

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

        <div className="mt-3 rounded-2xl bg-violet-50 p-3 ring-1 ring-violet-100">
          <p className="text-xs font-black text-violet-700">
            구매 조건 확인
          </p>
          {needsColor && (
            <div className="mt-3">
              <label className="text-[11px] font-black text-violet-600">
                무슨 색으로 살까요?
              </label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {["블랙", "다크브라운", "초코브라운", "애쉬브라운"].map(
                  (color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() =>
                        updateAssistantDraft(item.id, {
                          color,
                          error: null,
                        })
                      }
                      className={`rounded-full px-3 py-1.5 text-[11px] font-black ${
                        assistantDraft.color === color
                          ? "bg-violet-600 text-white"
                          : "bg-white text-violet-600 ring-1 ring-violet-100"
                      }`}
                    >
                      {color}
                    </button>
                  )
                )}
              </div>
              <input
                value={assistantDraft.color}
                onChange={(event) =>
                  updateAssistantDraft(item.id, {
                    color: event.target.value,
                    error: null,
                  })
                }
                placeholder="직접 입력"
                className="mt-2 w-full rounded-xl border border-violet-100 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-violet-400"
              />
            </div>
          )}

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-black text-violet-600">
                어떤 기준이 중요해요?
              </label>
              <select
                value={assistantDraft.preference}
                onChange={(event) =>
                  updateAssistantDraft(item.id, {
                    preference: event.target.value as
                      | ProductSearchPreference
                      | "",
                    error: null,
                  })
                }
                className="mt-1 w-full rounded-xl border border-violet-100 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-violet-400"
              >
                <option value="">추천 기준 선택</option>
                {PURCHASE_PREFERENCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-black text-violet-600">
                최대 가격
              </label>
              <input
                type="number"
                min="0"
                value={assistantDraft.budget}
                onChange={(event) =>
                  updateAssistantDraft(item.id, {
                    budget: event.target.value,
                    error: null,
                  })
                }
                placeholder="원"
                className="mt-1 w-full rounded-xl border border-violet-100 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-violet-400"
              />
            </div>
          </div>

          {assistantDraft.error && (
            <p className="mt-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-violet-700 ring-1 ring-violet-100">
              {assistantDraft.error}
            </p>
          )}

          <button
            type="button"
            onClick={() =>
              searchPurchaseProducts({
                item,
                productName,
                matchedHistory,
              })
            }
            disabled={assistantDraft.isSearching}
            className="mt-3 w-full rounded-xl bg-violet-600 px-3 py-2 text-xs font-black text-white disabled:bg-slate-300"
          >
            {assistantDraft.isSearching ? "상품 찾는 중" : "조건에 맞는 상품 찾기"}
          </button>
        </div>

        {assistantDraft.products.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-black text-slate-700">
              이 물건을 구매할까요?
            </p>
            {assistantDraft.products.map((product) => (
              <article
                key={product.id}
                className="flex gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100"
              >
                {product.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.image}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-white text-[11px] font-black text-slate-400 ring-1 ring-slate-100">
                    검색
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-xs font-black leading-5 text-slate-900">
                    {product.title}
                  </p>
                  <p className="mt-1 text-[11px] font-bold text-slate-400">
                    {product.mallName}
                    {product.lowestPriceKrw
                      ? ` · ${product.lowestPriceKrw.toLocaleString("ko-KR")}원`
                      : ""}
                  </p>
                  {product.matchLabel && (
                    <p className="mt-1 text-[11px] font-black text-emerald-600">
                      {product.matchLabel}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      confirmProductCandidate({
                        item,
                        matchedHistory,
                        selectedProduct: product,
                      })
                    }
                    className="mt-2 rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-black text-white"
                  >
                    이 물건으로 구매 준비
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

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

  if (agentItems.length === 0 && dueRepurchaseHistories.length === 0) {
    if (compact) return null;

    return (
      <section className="app-card p-5">
        <h2 className="text-lg font-black text-slate-900">즉시처리 확인함</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {instantActionEnabled
            ? "“쿠팡에서 시켜줘”, “네이버로 예약해줘” 같은 요청이 저장되면 이곳에서 필요한 확인사항을 모아볼 수 있습니다."
            : "즉시처리 자동 사용이 꺼져 있어 구매와 예약 요청을 조용히 저장만 합니다. 설정에서 다시 켤 수 있습니다."}
        </p>
      </section>
    );
  }

  if (compact) {
    const compactRepurchaseHistories =
      typeof maxItems === "number"
        ? dueRepurchaseHistories.slice(
            0,
            Math.max(maxItems - visibleItems.length, 0)
          )
        : dueRepurchaseHistories;

    return (
      <section className="app-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-slate-900">확인할 위임</h3>
            <p className="mt-1 text-xs font-bold leading-5 text-slate-400">
              홈에서는 확정/보류만 빠르게 처리합니다.
            </p>
          </div>
          <Link
            href="/records"
            className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-600"
          >
            전체 {agentItems.length + dueRepurchaseHistories.length}
          </Link>
        </div>

        {message && (
          <p className="mb-3 rounded-2xl bg-violet-50 px-4 py-3 text-sm font-bold text-violet-700 ring-1 ring-violet-100">
            {message}
          </p>
        )}

        <div className="space-y-2">
          {compactRepurchaseHistories.map((history) => (
            <article
              key={history.id}
              className="rounded-2xl bg-emerald-50 p-3 ring-1 ring-emerald-100"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-900">
                    {history.productName}
                  </p>
                  <p className="mt-1 text-xs font-black text-emerald-600">
                    재구매 확인
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-emerald-600 ring-1 ring-emerald-100">
                  추천일
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <a
                  href={createCoupangUrlFromHistory(history)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-emerald-600 px-3 py-2 text-center text-xs font-black text-white"
                >
                  열기
                </a>
                <button
                  type="button"
                  onClick={() => completeRepurchase(history)}
                  className="rounded-full bg-white px-3 py-2 text-xs font-black text-emerald-700 ring-1 ring-emerald-100"
                >
                  완료
                </button>
                <button
                  type="button"
                  onClick={() => postponeRepurchase(history)}
                  className="rounded-full bg-white px-3 py-2 text-xs font-black text-slate-500 ring-1 ring-slate-100"
                >
                  나중에
                </button>
              </div>
            </article>
          ))}

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

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => quickConfirm(item)}
                  className="flex-1 rounded-full bg-violet-600 px-3 py-2 text-xs font-black text-white"
                >
                  확정
                </button>
                <button
                  type="button"
                  onClick={() => quickHold(item)}
                  className="flex-1 rounded-full bg-white px-3 py-2 text-xs font-black text-slate-500 ring-1 ring-slate-100"
                >
                  나중에
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className={compact ? "app-card p-4" : "app-card p-5"}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-black text-slate-900">즉시처리 확인함</h2>
          {!compact && (
            <p className="mt-1 text-sm leading-6 text-slate-500">
              실제 구매와 예약은 사용자 확인 후 실행하도록 준비합니다.
            </p>
          )}
        </div>
        <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-600">
          {agentItems.length + dueRepurchaseHistories.length}개
        </span>
      </div>
      {message && (
        <p className="mb-3 rounded-2xl bg-violet-50 px-4 py-3 text-sm font-bold text-violet-700 ring-1 ring-violet-100">
          {message}
        </p>
      )}

      <div className="space-y-2">
        {dueRepurchaseHistories.map((history) => (
          <article
            key={history.id}
            className="rounded-2xl bg-emerald-50 p-3 ring-1 ring-emerald-100"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900">
                  {history.productName}
                </p>
                <p className="mt-1 text-xs font-black text-emerald-600">
                  재구매 확인
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-emerald-600 ring-1 ring-emerald-100">
                추천일
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              쿠팡 메일에서 확인한 구매 주기를 기준으로 다시 살 때가 됐습니다.
              결제 전에는 쿠팡에서 최종 확인해 주세요.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={createCoupangUrlFromHistory(history)}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-black text-white"
              >
                쿠팡 열기
              </a>
              <button
                type="button"
                onClick={() => completeRepurchase(history)}
                className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-emerald-700 ring-1 ring-emerald-100"
              >
                구매 완료
              </button>
              <button
                type="button"
                onClick={() => postponeRepurchase(history)}
                className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-500 ring-1 ring-slate-100"
              >
                나중에
              </button>
              <Link
                href="/purchase"
                className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-600 ring-1 ring-slate-100"
              >
                자동화 설정
              </Link>
            </div>
          </article>
        ))}

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
