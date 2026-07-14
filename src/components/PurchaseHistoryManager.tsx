"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createCoupangSearchUrl } from "@/lib/coupangLinks";
import { getCloudDataSyncedEventName } from "@/lib/dataSyncEvents";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
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
  repeatCycleDays: string;
  nextPurchaseCheckDate: string;
  autoRepurchaseEnabled: boolean;
  memo: string;
};

type MailConnectionStatus = {
  id: string;
  provider: "gmail" | "naver";
  email: string | null;
  sync_after: string;
  last_sync_at: string | null;
  status: "active" | "paused" | "error";
  last_error: string | null;
  updated_at: string;
};

type MailAutomationConfig = {
  hasGoogleOAuth: boolean;
  hasSupabaseAdmin: boolean;
  hasServerAutomation: boolean;
  hasOpenAi: boolean;
  hasCronSecret: boolean;
  canCheckSchema: boolean;
  hasPurchaseMailSchema: boolean;
  supabaseProjectRef: string | null;
  supabaseSqlEditorUrl: string | null;
  cronSchedule: string;
  automationStartDate: string;
};

const INITIAL_MAIL_IMPORT_PENDING_KEY =
  "my-assistant-purchase-mail-initial-import-pending";

function createEmptyDraft(): PurchaseDraft {
  return {
    id: null,
    productName: "",
    productUrl: "",
    defaultQuantity: "1",
    maxBudgetKrw: "",
    repeatCycleDays: "",
    nextPurchaseCheckDate: "",
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
    repeatCycleDays: history.repeatCycleDays
      ? String(history.repeatCycleDays)
      : "",
    nextPurchaseCheckDate: history.nextPurchaseCheckDate ?? "",
    autoRepurchaseEnabled: history.autoRepurchaseEnabled,
    memo: history.memo,
  };
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDaysToDateInput(dateText: string, days: number) {
  const baseDate = dateText ? new Date(`${dateText}T00:00:00`) : new Date();

  if (Number.isNaN(baseDate.getTime())) {
    return "";
  }

  baseDate.setDate(baseDate.getDate() + days);

  return toDateInputValue(baseDate);
}

function formatDateLabel(dateText?: string | null) {
  if (!dateText) return "미정";

  const date = new Date(`${dateText}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "미정";

  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function formatMailConnectionError(error: string | null) {
  if (!error) return null;

  if (/command failed/i.test(error)) {
    return "메일 서버가 요청을 거절했어. 네이버 메일 IMAP 사용 설정과 앱 비밀번호를 확인한 뒤 다시 불러오기를 눌러줘.";
  }

  if (/auth|authentication|login|password|credentials/i.test(error)) {
    return "메일 로그인 정보가 맞지 않는 것 같아. 앱 비밀번호를 새로 발급해서 다시 연결해줘.";
  }

  return error;
}

function getDaysUntil(dateText?: string | null) {
  if (!dateText) return null;

  const today = new Date();
  const target = new Date(`${dateText}T00:00:00`);

  today.setHours(0, 0, 0, 0);

  if (Number.isNaN(target.getTime())) return null;

  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function normalizeDraft(
  draft: PurchaseDraft,
  existingHistory?: PurchaseHistoryItem
): PurchaseHistoryItem {
  const now = new Date().toISOString();
  const quantity = Number(draft.defaultQuantity);
  const maxBudget = Number(draft.maxBudgetKrw);
  const repeatCycleDays = Number(draft.repeatCycleDays);
  const productName = draft.productName.trim();
  const nextPurchaseCheckDate = draft.nextPurchaseCheckDate.trim();

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
    repeatCycleDays:
      Number.isFinite(repeatCycleDays) && repeatCycleDays > 0
        ? repeatCycleDays
        : null,
    nextPurchaseCheckDate: nextPurchaseCheckDate || null,
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
  const [selectedCandidate, setSelectedCandidate] =
    useState<MailImportCandidate | null>(null);
  const [isImportingMail, setIsImportingMail] = useState(false);
  const [mailConnections, setMailConnections] = useState<
    MailConnectionStatus[]
  >([]);
  const [mailAutomationMessage, setMailAutomationMessage] = useState<
    string | null
  >(null);
  const [pendingInitialMailImportProvider, setPendingInitialMailImportProvider] =
    useState<"gmail" | "naver" | null>(null);
  const [isMailAutomationBusy, setIsMailAutomationBusy] = useState(false);
  const [naverMailDraft, setNaverMailDraft] = useState({
    email: "",
    appPassword: "",
  });
  const [mailAutomationConfig, setMailAutomationConfig] =
    useState<MailAutomationConfig | null>(null);

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

  useEffect(() => {
    void refreshMailConnections();
    void refreshMailAutomationConfig();

    const searchParams = new URLSearchParams(window.location.search);
    const connectedProvider = searchParams.get("mail_connected");
    const mailError = searchParams.get("mail_error");

    if (connectedProvider === "gmail") {
      window.sessionStorage.setItem(INITIAL_MAIL_IMPORT_PENDING_KEY, "1");
      setPendingInitialMailImportProvider("gmail");
      setMailAutomationMessage(
        "Gmail을 연결했어. 기존 쿠팡 메일 정보를 지금 가져올 수 있어."
      );
    } else if (mailError) {
      setMailAutomationMessage(
        mailError === "missing_code"
          ? "Gmail 인증 코드가 없어 연결하지 못했어."
          : mailError === "expired_state"
            ? "Gmail 연결 시간이 만료됐어. 다시 연결해줘."
            : "메일 연결 중 문제가 생겼어."
      );
    }

    if (connectedProvider || mailError) {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("mail_connected");
      cleanUrl.searchParams.delete("mail_error");
      window.history.replaceState(
        null,
        "",
        `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`
      );
    }
  }, []);

  const enabledHistories = useMemo(() => {
    return histories.filter((history) => history.autoRepurchaseEnabled);
  }, [histories]);

  const upcomingHistories = useMemo(() => {
    return histories
      .filter((history) => history.nextPurchaseCheckDate)
      .map((history) => ({
        history,
        daysUntil: getDaysUntil(history.nextPurchaseCheckDate),
      }))
      .sort((left, right) => {
        return (left.daysUntil ?? 9999) - (right.daysUntil ?? 9999);
      })
      .slice(0, 3);
  }, [histories]);

  function resetDraft() {
    setDraft(createEmptyDraft());
    setSelectedCandidate(null);
  }

  async function getSupabaseAccessToken() {
    const supabase = createSupabaseBrowserClient();

    if (!supabase) return null;

    const { data } = await supabase.auth.getSession();

    return data.session?.access_token ?? null;
  }

  async function refreshMailConnections() {
    const accessToken = await getSupabaseAccessToken();

    if (!accessToken) {
      setMailAutomationMessage(
        "앱 계정으로 로그인하면 Gmail 자동 수집을 연결할 수 있어."
      );
      return;
    }

    const response = await fetch("/api/purchase/mail/status", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) return;

    const data = (await response.json()) as {
      connections: MailConnectionStatus[];
      message?: string;
    };

    setMailConnections(data.connections);
    setMailAutomationMessage(data.message ?? null);
  }

  async function refreshMailAutomationConfig() {
    const accessToken = await getSupabaseAccessToken();
    const response = await fetch("/api/purchase/mail/config", {
      headers: accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : {},
    });

    if (!response.ok) return;

    setMailAutomationConfig((await response.json()) as MailAutomationConfig);
  }

  async function handleCopySetupSql() {
    const response = await fetch("/api/purchase/mail/setup-sql");

    if (!response.ok) {
      setMailAutomationMessage("설정 SQL을 불러오지 못했어.");
      return;
    }

    const sql = await response.text();

    await navigator.clipboard.writeText(sql);
    setMailAutomationMessage(
      "Supabase SQL Editor에 붙여넣을 설정 SQL을 복사했어."
    );
  }

  async function handleCopyServerAutomationChecklist() {
    await navigator.clipboard.writeText(
      [
        "Vercel Production 환경변수에 아래 값을 추가하세요.",
        "",
        "필수:",
        "SUPABASE_SERVICE_ROLE_KEY=Supabase Project Settings > API > service_role key",
        "CRON_SECRET=임의의 긴 비밀 문자열",
        "OPENAI_API_KEY=OpenAI API Key",
        "",
        "Gmail 자동 수집을 쓸 경우 추가:",
        "GOOGLE_CLIENT_ID=Google OAuth Client ID",
        "GOOGLE_CLIENT_SECRET=Google OAuth Client Secret",
        "GOOGLE_GMAIL_REDIRECT_URI=https://my-secretary-remote.vercel.app/api/purchase/mail/gmail/callback",
        "",
        "환경변수 저장 후 Vercel에서 다시 배포하면 서버 자동 수집이 활성화됩니다.",
      ].join("\n")
    );
    setMailAutomationMessage("서버 자동 실행 설정 목록을 복사했어.");
  }

  async function handleConnectGmail() {
    const accessToken = await getSupabaseAccessToken();

    if (!accessToken) {
      setMailAutomationMessage("먼저 앱 계정으로 로그인해야 Gmail을 연결할 수 있어.");
      return;
    }

    setIsMailAutomationBusy(true);

    try {
      const response = await fetch("/api/purchase/mail/gmail/start", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = (await response.json()) as {
        authUrl?: string;
        error?: string;
      };

      if (!response.ok || !data.authUrl) {
        setMailAutomationMessage(
          data.error ?? "Gmail 연결 준비에 실패했어."
        );
        return;
      }

      window.location.href = data.authUrl;
    } finally {
      setIsMailAutomationBusy(false);
    }
  }

  async function handleSyncMailNow(options?: {
    backfill?: boolean;
    connectionId?: string;
  }) {
    const accessToken = await getSupabaseAccessToken();

    if (!accessToken) {
      setMailAutomationMessage("먼저 앱 계정으로 로그인해야 메일을 확인할 수 있어.");
      return;
    }

    setIsMailAutomationBusy(true);

    try {
      const response = await fetch("/api/purchase/mail/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(options ?? {}),
      });
      const data = (await response.json()) as {
        importedCount?: number;
        messageCount?: number;
        importedHistories?: PurchaseHistoryItem[];
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        setMailAutomationMessage(data.error ?? "메일 확인에 실패했어.");
        return;
      }

      (data.importedHistories ?? []).forEach((history) => {
        savePurchaseHistory(history);
      });

      setHistories(getPurchaseHistories());
      await refreshMailConnections();
      setMailAutomationMessage(
        data.message ??
          `${options?.backfill ? "기존 메일을 다시 확인했어. " : ""}메일 ${data.messageCount ?? 0}개를 확인했고 구매템 ${data.importedCount ?? 0}개를 저장했어.`
      );
    } finally {
      setIsMailAutomationBusy(false);
    }
  }

  async function handleInitialMailImportNow() {
    await handleSyncMailNow({
      backfill: true,
    });
    window.sessionStorage.removeItem(INITIAL_MAIL_IMPORT_PENDING_KEY);
    setPendingInitialMailImportProvider(null);
  }

  async function handleBackfillMailConnection(connection: MailConnectionStatus) {
    const shouldImport = window.confirm(
      `${connection.provider === "gmail" ? "Gmail" : "네이버 메일"}${connection.email ? `(${connection.email})` : ""}에서 2026년 7월 14일 이후 쿠팡 메일을 다시 확인할까요? 이미 저장된 메일은 중복 저장하지 않습니다.`
    );

    if (!shouldImport) return;

    await handleSyncMailNow({
      backfill: true,
      connectionId: connection.id,
    });
  }

  function dismissInitialMailImport() {
    window.sessionStorage.removeItem(INITIAL_MAIL_IMPORT_PENDING_KEY);
    setPendingInitialMailImportProvider(null);
    setMailAutomationMessage(
      "좋아. 이후 도착하는 쿠팡 메일은 자동 확인 설정에 따라 수집됩니다."
    );
  }

  async function handleConnectNaverMail() {
    const accessToken = await getSupabaseAccessToken();

    if (!accessToken) {
      setMailAutomationMessage("먼저 앱 계정으로 로그인해야 네이버 메일을 연결할 수 있어.");
      return;
    }

    setIsMailAutomationBusy(true);

    try {
      const response = await fetch("/api/purchase/mail/naver/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(naverMailDraft),
      });
      const data = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        setMailAutomationMessage(data.error ?? "네이버 메일 연결에 실패했어.");
        return;
      }

      setNaverMailDraft({
        email: "",
        appPassword: "",
      });
      await refreshMailConnections();
      window.sessionStorage.setItem(INITIAL_MAIL_IMPORT_PENDING_KEY, "1");
      setPendingInitialMailImportProvider("naver");
      setMailAutomationMessage(
        "네이버 메일을 연결했어. 기존 쿠팡 메일 정보를 지금 가져올 수 있어."
      );
    } finally {
      setIsMailAutomationBusy(false);
    }
  }

  async function handleDeleteMailConnection(connectionId: string) {
    const shouldDelete = window.confirm(
      "메일 자동 수집 연결을 삭제할까요? 저장된 구매템은 그대로 유지됩니다."
    );

    if (!shouldDelete) return;

    const accessToken = await getSupabaseAccessToken();

    if (!accessToken) {
      setMailAutomationMessage("로그인이 필요합니다.");
      return;
    }

    const response = await fetch(
      `/api/purchase/mail/connections/${connectionId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      setMailAutomationMessage("메일 연결 삭제에 실패했어.");
      return;
    }

    await refreshMailConnections();
    setMailAutomationMessage("메일 자동 수집 연결을 삭제했어.");
  }

  async function forgetMailImportDetails({
    shouldConfirm = true,
  }: {
    shouldConfirm?: boolean;
  } = {}) {
    if (shouldConfirm) {
      const shouldForget = window.confirm(
        "메일 수집 기록에서 상품명과 제목을 비울까요? 같은 메일이 다시 수집되지 않도록 메일 식별값만 남겨둡니다."
      );

      if (!shouldForget) return false;
    }

    const accessToken = await getSupabaseAccessToken();

    if (!accessToken) {
      setMailAutomationMessage("먼저 앱 계정으로 로그인해야 수집 기록을 비울 수 있어.");
      return false;
    }

    const response = await fetch("/api/purchase/mail/imports", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      setMailAutomationMessage(
        data.error ?? "메일 수집 기록을 비우지 못했어."
      );
      return false;
    }

    setMailAutomationMessage("메일 수집 기록의 상품명과 제목을 비웠어.");
    return true;
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

  async function deleteRemotePurchaseHistories(ids: string[]) {
    if (ids.length === 0) return;

    const supabase = createSupabaseBrowserClient();

    if (!supabase) return;

    const { data } = await supabase.auth.getSession();

    if (!data.session?.user) return;

    await supabase
      .from("purchase_history")
      .delete()
      .eq("user_id", data.session.user.id)
      .in("id", ids);
  }

  async function handleDelete(id: string) {
    deletePurchaseHistory(id);
    setHistories(getPurchaseHistories());
    setMessage("구매 이력을 삭제했어.");

    await deleteRemotePurchaseHistories([id]);
  }

  async function handleDeleteAllHistories() {
    const shouldDelete = window.confirm(
      "저장된 구매템을 모두 삭제할까요? 이 작업은 되돌릴 수 없습니다."
    );

    if (!shouldDelete) return;

    const historyIds = histories.map((history) => history.id);

    histories.forEach((history) => deletePurchaseHistory(history.id));
    setHistories(getPurchaseHistories());
    resetDraft();
    setMessage("저장된 구매템을 모두 삭제했어.");

    await deleteRemotePurchaseHistories(historyIds);
    await forgetMailImportDetails({ shouldConfirm: false });
  }

  function handleClearImportData() {
    setMailText("");
    setMailCandidates([]);
    setSelectedCandidate(null);
    setMessage("붙여넣은 주문 정보와 후보를 지웠어.");
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
    setSelectedCandidate(candidate);
    setDraft((current) => ({
      ...current,
      id: null,
      productName: candidate.productName,
      productUrl: candidate.productUrl,
      defaultQuantity: candidate.quantityText
        ? candidate.quantityText.replace(/[^0-9]/g, "") || current.defaultQuantity
        : current.defaultQuantity,
      memo: candidate.priceText
        ? `쿠팡 주문 정보에서 가져옴 · ${candidate.priceText}`
        : "쿠팡 주문 정보에서 가져옴",
    }));
    setMessage("이 상품이 맞는지 확인하고 재구매 주기를 정해 저장하면 돼.");
  }

  function handleRepeatCycleChange(value: string) {
    const days = Number(value);

    setDraft((current) => ({
      ...current,
      repeatCycleDays: value,
      nextPurchaseCheckDate:
        Number.isFinite(days) && days > 0
          ? addDaysToDateInput("", days)
          : current.nextPurchaseCheckDate,
    }));
  }

  return (
    <section className="space-y-5">
      <section className="app-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900">
              쿠팡 메일 자동 수집
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              2026년 7월 14일 이후 도착한 쿠팡 메일을 읽어 구매템과 재구매
              추천일을 자동으로 저장합니다.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-600">
            자동화
          </span>
        </div>

        <div className="mt-4 grid gap-2">
          {mailAutomationConfig && (
            <div className="grid grid-cols-2 gap-2 text-xs font-black sm:grid-cols-4">
              <span
                className={`rounded-2xl px-3 py-2 text-center ${
                  mailAutomationConfig.hasOpenAi
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-rose-50 text-rose-600"
                }`}
              >
                AI 분석 {mailAutomationConfig.hasOpenAi ? "준비" : "필요"}
              </span>
              <span
                className={`rounded-2xl px-3 py-2 text-center ${
                  mailAutomationConfig.hasServerAutomation
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-amber-50 text-amber-600"
                }`}
              >
                자동 실행{" "}
                {mailAutomationConfig.hasServerAutomation ? "준비" : "제한"}
              </span>
              <span
                className={`rounded-2xl px-3 py-2 text-center ${
                  mailAutomationConfig.hasPurchaseMailSchema
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-rose-50 text-rose-600"
                }`}
              >
                DB{" "}
                {mailAutomationConfig.canCheckSchema
                  ? mailAutomationConfig.hasPurchaseMailSchema
                    ? "준비"
                    : "필요"
                  : "확인전"}
              </span>
              <span
                className={`rounded-2xl px-3 py-2 text-center ${
                  mailAutomationConfig.hasGoogleOAuth
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                Gmail {mailAutomationConfig.hasGoogleOAuth ? "준비" : "미설정"}
              </span>
              <span className="rounded-2xl bg-blue-50 px-3 py-2 text-center text-blue-600">
                {mailAutomationConfig.cronSchedule}
              </span>
            </div>
          )}

          {mailAutomationConfig?.canCheckSchema &&
            !mailAutomationConfig.hasPurchaseMailSchema && (
              <div className="rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-100">
                <p className="text-xs font-bold leading-5 text-rose-600">
                  Supabase에 쿠팡 자동화 테이블이 아직 없습니다. 설정 SQL을
                  SQL Editor에서 실행해야 메일 연결과 자동 수집이 저장됩니다.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleCopySetupSql}
                    className="rounded-2xl bg-white px-3 py-2 text-xs font-black text-rose-600 ring-1 ring-rose-100"
                  >
                    설정 SQL 복사
                  </button>
                  {mailAutomationConfig.supabaseSqlEditorUrl ? (
                    <a
                      href={mailAutomationConfig.supabaseSqlEditorUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-2xl bg-rose-600 px-3 py-2 text-center text-xs font-black text-white"
                    >
                      SQL Editor 열기
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="rounded-2xl bg-slate-200 px-3 py-2 text-xs font-black text-slate-400"
                    >
                      SQL Editor
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void refreshMailAutomationConfig();
                    void refreshMailConnections();
                  }}
                  className="mt-2 w-full rounded-2xl bg-white px-3 py-2 text-xs font-black text-slate-600 ring-1 ring-slate-100"
                >
                  설정 후 다시 확인
                </button>
              </div>
            )}

          {mailAutomationConfig &&
            mailAutomationConfig.hasPurchaseMailSchema &&
            !mailAutomationConfig.hasServerAutomation && (
              <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-100">
                <p className="text-xs font-bold leading-5 text-amber-700">
                  앱을 열 때 자동 확인은 동작하지만, 서버가 매일 알아서 전체
                  사용자의 쿠팡 메일을 확인하려면 Vercel Production 환경변수에{" "}
                  <span className="font-black">SUPABASE_SERVICE_ROLE_KEY</span>
                  와 <span className="font-black">CRON_SECRET</span>이 모두
                  필요합니다.
                </p>
                <button
                  type="button"
                  onClick={handleCopyServerAutomationChecklist}
                  className="mt-3 w-full rounded-2xl bg-white px-3 py-2 text-xs font-black text-amber-700 ring-1 ring-amber-100"
                >
                  서버 자동 실행 설정 목록 복사
                </button>
              </div>
            )}

          {mailConnections.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 p-4 text-xs font-bold leading-5 text-slate-500 ring-1 ring-slate-100">
              아직 연결된 메일이 없습니다. Gmail은 공식 읽기 권한으로 연결하고,
              네이버 메일은 IMAP 앱 비밀번호 방식이 필요합니다.
            </p>
          ) : (
            mailConnections.map((connection) => (
              <div
                key={connection.id}
                className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-slate-900">
                    {connection.provider === "gmail" ? "Gmail" : "네이버 메일"}
                    {connection.email ? ` · ${connection.email}` : ""}
                  </p>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-black ${
                      connection.status === "active"
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-rose-50 text-rose-600"
                    }`}
                  >
                    {connection.status === "active" ? "연결됨" : "확인 필요"}
                  </span>
                </div>
                <p className="mt-2 text-xs font-bold text-slate-400">
                  마지막 확인:{" "}
                  {connection.last_sync_at
                    ? formatDateLabel(connection.last_sync_at.slice(0, 10))
                    : "아직 없음"}
                </p>
                {formatMailConnectionError(connection.last_error) && (
                  <p className="mt-2 text-xs font-bold text-rose-500">
                    {formatMailConnectionError(connection.last_error)}
                  </p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleBackfillMailConnection(connection)}
                    disabled={isMailAutomationBusy}
                    className="rounded-full bg-white px-3 py-2 text-xs font-black text-blue-600 ring-1 ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    기존 메일 다시 불러오기
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteMailConnection(connection.id)}
                    className="rounded-full bg-white px-3 py-2 text-xs font-black text-rose-500 ring-1 ring-rose-100"
                  >
                    메일 연결 삭제
                  </button>
                </div>
              </div>
            ))
          )}

          {pendingInitialMailImportProvider && (
            <div className="rounded-3xl bg-blue-600 p-4 text-white shadow-soft">
              <p className="text-xs font-black text-blue-100">
                기존 메일 가져오기
              </p>
              <h3 className="mt-1 text-base font-black">
                지금까지 받은 쿠팡 메일을 한번에 가져올까요?
              </h3>
              <p className="mt-2 text-xs font-semibold leading-5 text-blue-100">
                {pendingInitialMailImportProvider === "gmail"
                  ? "Gmail"
                  : "네이버 메일"}
                에서 2026년 7월 14일 이후 쿠팡 메일을 확인해 구매템과
                재구매 추천일을 저장합니다. 이미 가져온 메일은 중복 저장하지
                않습니다.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleInitialMailImportNow}
                  disabled={isMailAutomationBusy}
                  className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-blue-700 disabled:bg-blue-200 disabled:text-blue-500"
                >
                  예, 가져오기
                </button>
                <button
                  type="button"
                  onClick={dismissInitialMailImport}
                  disabled={isMailAutomationBusy}
                  className="rounded-2xl bg-blue-500 px-4 py-3 text-sm font-black text-white disabled:bg-blue-400"
                >
                  나중에
                </button>
              </div>
            </div>
          )}
        </div>

        {mailAutomationMessage && (
          <p className="mt-4 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 ring-1 ring-blue-100">
            {mailAutomationMessage}
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleConnectGmail}
            disabled={isMailAutomationBusy}
            className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white disabled:bg-slate-300"
          >
            Gmail 연결
          </button>
          <button
            type="button"
            onClick={() => handleSyncMailNow()}
            disabled={isMailAutomationBusy}
            className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:bg-slate-300"
          >
            지금 메일 확인
          </button>
        </div>

        <div className="mt-4 rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-100">
          <p className="text-sm font-black text-slate-900">
            네이버 메일 연결
          </p>
          <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
            네이버 메일은 IMAP 사용과 앱 비밀번호가 필요합니다. 입력한 값은
            메일 수집 서버에서만 사용합니다.
          </p>
          <div className="mt-3 grid gap-2">
            <input
              value={naverMailDraft.email}
              onChange={(event) =>
                setNaverMailDraft((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              placeholder="네이버 메일 주소"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400"
            />
            <input
              type="password"
              value={naverMailDraft.appPassword}
              onChange={(event) =>
                setNaverMailDraft((current) => ({
                  ...current,
                  appPassword: event.target.value,
                }))
              }
              placeholder="네이버 앱 비밀번호"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400"
            />
            <button
              type="button"
              onClick={handleConnectNaverMail}
              disabled={isMailAutomationBusy}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200 disabled:bg-slate-200"
            >
              네이버 메일 연결
            </button>
          </div>
        </div>
      </section>

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
          {(mailText || mailCandidates.length > 0 || selectedCandidate) && (
            <button
              type="button"
              onClick={handleClearImportData}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-rose-500 ring-1 ring-rose-100"
            >
              붙여넣은 정보 지우기
            </button>
          )}
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
                <span className="mt-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-600">
                  이 상품으로 저장 준비
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
              쿠팡 재구매 준비
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              이미 산 적 있는 상품만 등록하고, 쿠팡 페이지를 열어 결제
              직전까지 빠르게 이동합니다.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 text-right">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-600">
              {enabledHistories.length}개 허용
            </span>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-600">
              {upcomingHistories.length}개 예정
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {histories.length > 0 && (
            <button
              type="button"
              onClick={handleDeleteAllHistories}
              className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-600 ring-1 ring-rose-100"
            >
              저장된 구매템 전체 삭제
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              void forgetMailImportDetails();
            }}
            className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-600 ring-1 ring-slate-200"
          >
            메일 수집 기록 비우기
          </button>
        </div>

        {message && (
          <p className="mt-4 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 ring-1 ring-blue-100">
            {message}
          </p>
        )}

        {selectedCandidate && (
          <div className="mt-4 rounded-3xl bg-slate-900 p-4 text-white">
            <p className="text-xs font-black text-blue-200">저장 후보 확인</p>
            <h3 className="mt-2 text-base font-black">
              {selectedCandidate.productName}
            </h3>
            <p className="mt-2 text-xs font-bold leading-5 text-slate-300">
              {selectedCandidate.priceText ?? "가격 정보 없음"}
              {selectedCandidate.quantityText
                ? ` · ${selectedCandidate.quantityText}`
                : ""}
              {selectedCandidate.orderDateText
                ? ` · ${selectedCandidate.orderDateText}`
                : ""}
            </p>
            <p className="mt-3 text-xs font-semibold leading-5 text-slate-300">
              아래에서 수량, 예산, 재구매 주기를 확인한 뒤 저장하면 “내
              구매템”으로 관리됩니다.
            </p>
          </div>
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-black text-slate-500">
                재구매 주기
              </label>
              <select
                value={draft.repeatCycleDays}
                onChange={(event) => handleRepeatCycleChange(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400"
              >
                <option value="">정하지 않음</option>
                <option value="14">2주마다</option>
                <option value="30">30일마다</option>
                <option value="45">45일마다</option>
                <option value="60">60일마다</option>
                <option value="90">90일마다</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-black text-slate-500">
                다음 구매 확인일
              </label>
              <input
                type="date"
                value={draft.nextPurchaseCheckDate}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    nextPurchaseCheckDate: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400"
              />
            </div>
          </div>

          <label className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-100">
            재구매 추천 허용
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
              {draft.id ? "수정 저장" : "내 구매템 저장"}
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
        {upcomingHistories.length > 0 && (
          <div className="app-card p-5">
            <h2 className="text-base font-black text-slate-900">
              곧 확인할 구매템
            </h2>
            <div className="mt-3 space-y-2">
              {upcomingHistories.map(({ history, daysUntil }) => (
                <button
                  key={history.id}
                  type="button"
                  onClick={() => setDraft(createDraftFromHistory(history))}
                  className="w-full rounded-2xl bg-slate-50 p-3 text-left ring-1 ring-slate-100"
                >
                  <span className="block text-sm font-black text-slate-900">
                    {history.productName}
                  </span>
                  <span className="mt-1 block text-xs font-bold text-slate-500">
                    {formatDateLabel(history.nextPurchaseCheckDate)}
                    {daysUntil !== null
                      ? daysUntil <= 0
                        ? " · 오늘 확인"
                        : ` · ${daysUntil}일 후`
                      : ""}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

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
                    {history.repeatCycleDays
                      ? ` · ${history.repeatCycleDays}일마다`
                      : ""}
                  </p>
                  <p className="mt-1 text-xs font-bold text-blue-500">
                    다음 확인: {formatDateLabel(history.nextPurchaseCheckDate)}
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
