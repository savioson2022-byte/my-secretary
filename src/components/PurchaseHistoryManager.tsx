"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getCloudDataSyncedEventName } from "@/lib/dataSyncEvents";
import {
  createId,
  deletePurchaseHistory,
  getPurchaseHistories,
  savePurchaseHistory,
  updatePurchaseHistory,
} from "@/lib/purchaseHistoryStorage";
import {
  parseCoupangOrderMailFallback,
  type MailImportCandidate,
  type PurchaseMailImportResult,
} from "@/lib/purchaseMailImport";
import type { PurchaseHistoryItem } from "@/types/purchaseHistory";

type PurchaseDraft = {
  id: string | null;
  productName: string;
  productUrl: string;
  defaultQuantity: string;
  maxBudgetKrw: string;
  autoRepurchaseEnabled: boolean;
  memo: string;
};

function createEmptyDraft(): PurchaseDraft {
  return {
    id: null,
    productName: "",
    productUrl: "",
    defaultQuantity: "1",
    maxBudgetKrw: "",
    autoRepurchaseEnabled: false,
    memo: "",
  };
}

function createDraftFromHistory(history: PurchaseHistoryItem): PurchaseDraft {
  return {
    id: history.id,
    productName: history.productName,
    productUrl: history.productUrl ?? "",
    defaultQuantity: history.defaultQuantity
      ? String(history.defaultQuantity)
      : "1",
    maxBudgetKrw: history.maxBudgetKrw ? String(history.maxBudgetKrw) : "",
    autoRepurchaseEnabled: history.autoRepurchaseEnabled,
    memo: history.memo,
  };
}

function createCoupangSearchUrl(productName: string) {
  return `https://www.coupang.com/np/search?q=${encodeURIComponent(
    productName
  )}`;
}

function normalizeDraft(
  draft: PurchaseDraft,
  existingHistory?: PurchaseHistoryItem
): PurchaseHistoryItem {
  const now = new Date().toISOString();
  const quantity = Number(draft.defaultQuantity);
  const maxBudget = Number(draft.maxBudgetKrw);
  const productName = draft.productName.trim();

  return {
    id: draft.id ?? existingHistory?.id ?? createId(),
    productName,
    platform: "coupang",
    productUrl:
      draft.productUrl.trim() || (productName ? createCoupangSearchUrl(productName) : null),
    defaultQuantity:
      Number.isFinite(quantity) && quantity > 0 ? quantity : null,
    maxBudgetKrw:
      Number.isFinite(maxBudget) && maxBudget > 0 ? maxBudget : null,
    autoRepurchaseEnabled: draft.autoRepurchaseEnabled,
    lastPurchasedAt: existingHistory?.lastPurchasedAt ?? now,
    memo: draft.memo.trim(),
    createdAt: existingHistory?.createdAt ?? now,
    updatedAt: now,
  };
}

function getAutomationCommand(history: PurchaseHistoryItem) {
  const args = [
    "npm run purchase:coupang --",
    `--product "${history.productName.replaceAll('"', '\\"')}"`,
  ];

  if (history.productUrl) {
    args.push(`--url "${history.productUrl.replaceAll('"', '\\"')}"`);
  }

  if (history.defaultQuantity) {
    args.push(`--quantity ${history.defaultQuantity}`);
  }

  if (history.maxBudgetKrw) {
    args.push(`--max-budget ${history.maxBudgetKrw}`);
  }

  args.push("--confirm");

  return args.join(" ");
}

export default function PurchaseHistoryManager() {
  const [histories, setHistories] = useState<PurchaseHistoryItem[]>([]);
  const [draft, setDraft] = useState<PurchaseDraft>(createEmptyDraft);
  const [message, setMessage] = useState<string | null>(null);
  const [mailText, setMailText] = useState("");
  const [mailCandidates, setMailCandidates] = useState<MailImportCandidate[]>([]);
  const [isImportingMail, setIsImportingMail] = useState(false);

  useEffect(() => {
    function refreshHistories() {
      setHistories(getPurchaseHistories());
    }

    refreshHistories();
    window.addEventListener(getCloudDataSyncedEventName(), refreshHistories);

    return () => {
      window.removeEventListener(
        getCloudDataSyncedEventName(),
        refreshHistories
      );
    };
  }, []);

  const enabledHistories = useMemo(() => {
    return histories.filter((history) => history.autoRepurchaseEnabled);
  }, [histories]);

  function resetDraft() {
    setDraft(createEmptyDraft());
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.productName.trim()) {
      setMessage("상품명을 입력해야 저장할 수 있어.");
      return;
    }

    const existingHistory = histories.find((history) => history.id === draft.id);
    const nextHistory = normalizeDraft(draft, existingHistory);

    if (existingHistory) {
      updatePurchaseHistory(nextHistory);
      setMessage("구매 이력을 수정했어.");
    } else {
      savePurchaseHistory(nextHistory);
      setMessage("구매 이력을 추가했어.");
    }

    setHistories(getPurchaseHistories());
    resetDraft();
  }

  function handleDelete(id: string) {
    deletePurchaseHistory(id);
    setHistories(getPurchaseHistories());
    setMessage("구매 이력을 삭제했어.");
  }

  async function copyCommand(history: PurchaseHistoryItem) {
    const command = getAutomationCommand(history);

    await navigator.clipboard.writeText(command);
    setMessage("로컬 실행 명령을 복사했어.");
  }

  async function handleParseMail() {
    if (!mailText.trim()) {
      setMessage("쿠팡 주문 메일이나 구매 상세정보 내용을 먼저 붙여넣어줘.");
      return;
    }

    setIsImportingMail(true);

    try {
      const response = await fetch("/api/purchase/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: mailText,
        }),
      });

      if (!response.ok) {
        throw new Error("구매 메일 분석 요청에 실패했습니다.");
      }

      const result = (await response.json()) as PurchaseMailImportResult;

      setMailCandidates(result.candidates);
      setMessage(
        result.candidates.length > 0
          ? `${result.source === "ai" ? "AI가" : "기본 분석으로"} ${result.candidates.length}개의 구매 후보를 찾았어. 맞는 상품만 저장하면 돼.`
          : "상품 후보를 찾지 못했어. 쿠팡 주문 상세정보의 상품명/옵션/가격 부분까지 복사했는지 확인해줘."
      );
    } catch {
      const candidates = parseCoupangOrderMailFallback(mailText);

      setMailCandidates(candidates);
      setMessage(
        candidates.length > 0
          ? `기본 분석으로 ${candidates.length}개의 구매 후보를 찾았어. 맞는 상품만 저장하면 돼.`
          : "상품 후보를 찾지 못했어. 쿠팡 주문 상세정보의 상품명/옵션/가격 부분까지 복사했는지 확인해줘."
      );
    } finally {
      setIsImportingMail(false);
    }
  }

  function handleUseCandidate(candidate: MailImportCandidate) {
    setDraft((current) => ({
      ...current,
      id: null,
      productName: candidate.productName,
      productUrl: candidate.productUrl,
      memo: candidate.priceText
        ? `쿠팡 주문 정보에서 가져옴 · ${candidate.priceText}`
        : "쿠팡 주문 정보에서 가져옴",
    }));
    setMessage("상품 후보를 입력칸에 넣었어. 수량과 예산만 확인하고 저장하면 돼.");
  }

  return (
    <section className="space-y-5">
      <section className="app-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900">
              쿠팡 주문 메일 가져오기
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              네이버 메일, Gmail, 쿠팡 구매 상세정보를 붙여넣으면 AI가 실제
              구매 상품 후보만 뽑아줍니다. 원문은 저장하지 않습니다.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
            네이버 · Gmail
          </span>
        </div>

        <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-xs font-bold leading-5 text-blue-700 ring-1 ring-blue-100">
          구매 상세정보처럼 잡음이 많은 화면은 AI가 먼저 분석합니다. AI가
          실패하거나 API 키가 없는 환경에서는 기본 분석으로 자동 전환됩니다.
        </div>

        <div className="mt-4 grid gap-3">
          <textarea
            value={mailText}
            onChange={(event) => setMailText(event.target.value)}
            rows={6}
            placeholder="쿠팡 주문 확인 메일이나 구매 상세정보 내용을 여기에 붙여넣으세요. 네이버 메일과 Gmail 모두 가능합니다."
            className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400"
          />
          <button
            type="button"
            onClick={handleParseMail}
            disabled={isImportingMail}
            className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isImportingMail ? "AI가 확인 중" : "AI로 상품 후보 찾기"}
          </button>
        </div>

        {mailCandidates.length > 0 && (
          <div className="mt-4 space-y-2">
            {mailCandidates.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => handleUseCandidate(candidate)}
                className="w-full rounded-2xl bg-white p-4 text-left ring-1 ring-slate-100"
              >
                <span className="block text-sm font-black text-slate-900">
                  {candidate.productName}
                </span>
                <span className="mt-1 block text-xs font-bold text-slate-400">
                  {candidate.priceText ?? "가격 정보 없음"}
                  {candidate.quantityText ? ` · ${candidate.quantityText}` : ""}
                  {candidate.confidence === "high" ? " · 확실함" : ""}
                  {candidate.confidence === "medium" ? " · 확인 필요" : ""}
                  {candidate.confidence === "low" ? " · 낮은 확신" : ""}
                </span>
                <span className="mt-1 block text-[11px] font-semibold leading-5 text-slate-400">
                  {candidate.reason}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="app-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900">
              쿠팡 재구매 자동화
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              이미 산 적 있는 상품만 등록하고, 로컬 기기에서 쿠팡 페이지를
              열어 결제 직전까지 빠르게 이동합니다.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-600">
            {enabledHistories.length}개 허용
          </span>
        </div>

        {message && (
          <p className="mt-4 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 ring-1 ring-blue-100">
            {message}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-5 grid gap-3">
          <div>
            <label className="text-xs font-black text-slate-500">상품명</label>
            <input
              value={draft.productName}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  productName: event.target.value,
                }))
              }
              placeholder="예: 물티슈"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400"
            />
          </div>

          <div>
            <label className="text-xs font-black text-slate-500">
              쿠팡 상품 URL
            </label>
            <input
              value={draft.productUrl}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  productUrl: event.target.value,
                }))
              }
              placeholder="비워두면 쿠팡 검색 URL을 사용합니다"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-black text-slate-500">
                기본 수량
              </label>
              <input
                type="number"
                min="1"
                value={draft.defaultQuantity}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    defaultQuantity: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs font-black text-slate-500">
                최대 금액
              </label>
              <input
                type="number"
                min="0"
                value={draft.maxBudgetKrw}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    maxBudgetKrw: event.target.value,
                  }))
                }
                placeholder="원"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400"
              />
            </div>
          </div>

          <label className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-100">
            재구매 자동화 허용
            <input
              type="checkbox"
              checked={draft.autoRepurchaseEnabled}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  autoRepurchaseEnabled: event.target.checked,
                }))
              }
              className="h-5 w-5 accent-blue-600"
            />
          </label>

          <div>
            <label className="text-xs font-black text-slate-500">메모</label>
            <textarea
              value={draft.memo}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  memo: event.target.value,
                }))
              }
              rows={3}
              className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="submit"
              className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white"
            >
              {draft.id ? "수정 저장" : "구매 이력 저장"}
            </button>
            <button
              type="button"
              onClick={resetDraft}
              className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-black text-slate-500 ring-1 ring-slate-100"
            >
              초기화
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        {histories.length === 0 ? (
          <div className="app-card p-5 text-sm font-semibold leading-6 text-slate-500">
            아직 등록된 구매 이력이 없습니다. 즉시처리 확인함에서 “이미 산 적
            있음”을 누르거나 이 페이지에서 직접 추가하세요.
          </div>
        ) : (
          histories.map((history) => (
            <article key={history.id} className="app-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-black text-slate-900">
                    {history.productName}
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-400">
                    {history.defaultQuantity ? `${history.defaultQuantity}개 · ` : ""}
                    {history.maxBudgetKrw
                      ? `${history.maxBudgetKrw.toLocaleString("ko-KR")}원 이하`
                      : "예산 미설정"}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${
                    history.autoRepurchaseEnabled
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {history.autoRepurchaseEnabled ? "허용" : "확인 필요"}
                </span>
              </div>

              <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-[11px] font-bold leading-5 text-slate-500 ring-1 ring-slate-100">
                {getAutomationCommand(history)}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={history.productUrl ?? createCoupangSearchUrl(history.productName)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-black text-white"
                >
                  쿠팡 열기
                </a>
                <button
                  type="button"
                  onClick={() => copyCommand(history)}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-600 ring-1 ring-slate-100"
                >
                  명령 복사
                </button>
                <button
                  type="button"
                  onClick={() => setDraft(createDraftFromHistory(history))}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-600 ring-1 ring-slate-100"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(history.id)}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-rose-500 ring-1 ring-rose-100"
                >
                  삭제
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </section>
  );
}
