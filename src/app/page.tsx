"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BottomNavigation from "@/components/BottomNavigation";
import AgentActionSuggestionView from "@/components/AgentActionSuggestionView";
import ClassificationResult from "@/components/ClassificationResult";
import FilterBar from "@/components/FilterBar";
import InputBox from "@/components/InputBox";
import ItemCard from "@/components/ItemCard";
import NotificationSummaryCard from "@/components/NotificationSummaryCard";
import UserStatusBadge from "@/components/UserStatusBadge";
import { aiClassifyInput } from "@/lib/aiClassifyInput";
import { classifyInput } from "@/lib/classifyInput";
import { buildClassificationContext } from "@/lib/classificationContext";
import { getCloudDataSyncedEventName } from "@/lib/dataSyncEvents";
import {
  groupIdeaWithAi,
  shouldAttachToIdeaRecord,
} from "@/lib/ideaGrouping";
import { getLocalDataUpdatedEventName } from "@/lib/localStorageRepository";
import {
  getDueRepurchaseHistories,
  getNextPurchaseDateFromToday,
} from "@/lib/purchaseAutomation";
import {
  getPurchaseHistories,
  updatePurchaseHistory,
} from "@/lib/purchaseHistoryStorage";
import { getPersonalAiMemories } from "@/lib/personalAiMemoryStorage";
import { getRoutineSchedules } from "@/lib/routineStorage";
import { createSingleScheduleFromItem } from "@/lib/singleScheduleFromItem";
import {
  getSingleSchedules,
  saveSingleSchedule,
} from "@/lib/singleScheduleStorage";
import { deleteItem, getItems, saveItem, updateItem } from "@/lib/storage";
import { getUserProfile } from "@/lib/userProfileStorage";
import {
  AssistantItem,
  AssistantItemWithoutId,
  FilterType,
} from "@/types/assistant";
import { SingleSchedule } from "@/types/calendar";
import { DayOfWeek, RoutineSchedule } from "@/types/routine";
import { UserProfile } from "@/types/userProfile";
import { PurchaseHistoryItem } from "@/types/purchaseHistory";

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function matchesFilter(item: AssistantItem, filter: FilterType) {
  if (filter === "전체") return true;

  if (filter === "미완료" || filter === "완료" || filter === "보류") {
    return item.status === filter;
  }

  return item.category === filter;
}

function isTodayOrPast(dateText: string | null) {
  if (!dateText) return false;

  const today = new Date();
  const todayText = today.toISOString().slice(0, 10);
  const targetDateText = dateText.slice(0, 10);

  return targetDateText <= todayText;
}

function isImportantTodayItem(item: AssistantItem) {
  if (item.status !== "미완료") return false;

  return (
    item.priority === "높음" ||
    isTodayOrPast(item.dueDate) ||
    isTodayOrPast(item.reminderDate)
  );
}

function getTodayText() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const date = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${date}`;
}

function getCurrentMinutes() {
  const now = new Date();

  return now.getHours() * 60 + now.getMinutes();
}

function getTimeMinutes(timeText: string) {
  const [hour = "0", minute = "0"] = timeText.split(":");

  return Number(hour) * 60 + Number(minute);
}

function getDayOfWeekFromDateText(dateText: string): DayOfWeek {
  const dayIndex = new Date(`${dateText}T00:00:00`).getDay();
  const daysByDateIndex: DayOfWeek[] = ["일", "월", "화", "수", "목", "금", "토"];

  return daysByDateIndex[dayIndex] ?? "월";
}

function isRoutineActiveOnDate(routine: RoutineSchedule, dateText: string) {
  if (routine.isActive === false) return false;
  if (routine.startDate && routine.startDate > dateText) return false;
  if (routine.endDate && routine.endDate < dateText) return false;
  if (routine.cancelledDates?.includes(dateText)) return false;

  return true;
}

export default function Home() {
  const [inputText, setInputText] = useState("");
  const [classificationResult, setClassificationResult] =
    useState<AssistantItemWithoutId | null>(null);
  const [items, setItems] = useState<AssistantItem[]>([]);
  const [routines, setRoutines] = useState<RoutineSchedule[]>([]);
  const [singleSchedules, setSingleSchedules] = useState<SingleSchedule[]>([]);
  const [purchaseHistories, setPurchaseHistories] = useState<
    PurchaseHistoryItem[]
  >([]);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("전체");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const [isClassifying, setIsClassifying] = useState(false);
  const [classificationSource, setClassificationSource] = useState<
    "gemma-on-device" | "ai" | "fallback" | null
  >(null);
  const [voiceIntent, setVoiceIntent] = useState(false);

  useEffect(() => {
    function refreshLocalData() {
      setItems(getItems());
      setRoutines(getRoutineSchedules());
      setSingleSchedules(getSingleSchedules());
      setPurchaseHistories(getPurchaseHistories());
      setUserProfile(getUserProfile());
    }

    refreshLocalData();

    const searchParams = new URLSearchParams(window.location.search);
    setVoiceIntent(searchParams.get("voice") === "1");

    window.addEventListener(getCloudDataSyncedEventName(), refreshLocalData);
    window.addEventListener(getLocalDataUpdatedEventName(), refreshLocalData);

    return () => {
      window.removeEventListener(
        getCloudDataSyncedEventName(),
        refreshLocalData
      );
      window.removeEventListener(
        getLocalDataUpdatedEventName(),
        refreshLocalData
      );
    };
  }, []);

  const todayItems = useMemo(() => {
    return items.filter(isImportantTodayItem);
  }, [items]);
  const todayScheduleItems = useMemo(() => {
    const todayText = getTodayText();
    const todayDay = getDayOfWeekFromDateText(todayText);
    const routineItems = routines
      .filter((routine) => {
        return (
          routine.dayOfWeek === todayDay &&
          isRoutineActiveOnDate(routine, todayText)
        );
      })
      .map((routine) => ({
        time: routine.startTime,
        title: routine.title,
        detail: `${routine.startTime} - ${routine.endTime} · ${
          routine.placeName || "위치 미입력"
        }`,
        tag: "정기",
      }));
    const singleItems = singleSchedules
      .filter((schedule) => schedule.date === todayText)
      .map((schedule) => ({
        time: schedule.startTime,
        title: schedule.title,
        detail: `${schedule.startTime} - ${schedule.endTime} · ${
          schedule.placeName || "위치 미입력"
        }`,
        tag: "단기",
      }));

    return [...routineItems, ...singleItems].sort((a, b) => {
      return a.time.localeCompare(b.time);
    });
  }, [routines, singleSchedules]);

  const nextTodaySchedule = useMemo(() => {
    const currentMinutes = getCurrentMinutes();

    return (
      todayScheduleItems.find((schedule) => {
        return getTimeMinutes(schedule.time) >= currentMinutes;
      }) ?? todayScheduleItems[0]
    );
  }, [todayScheduleItems]);

  const openMemoCount = useMemo(() => {
    return items.filter((item) => {
      return (
        item.status === "미완료" &&
        (item.processType === "메모" || item.processType === "아이디어")
      );
    }).length;
  }, [items]);

  const pendingAgentCount = useMemo(() => {
    if (userProfile?.instantActionAutoOpenEnabled === false) return 0;

    return items.filter((item) => {
      return (
        item.status === "미완료" &&
        (item.processType === "에이전트위임" ||
          item.actionType === "구매" ||
          item.actionType === "예약")
      );
    }).length;
  }, [items, userProfile]);

  const dueRepurchaseItems = useMemo(() => {
    return getDueRepurchaseHistories(purchaseHistories, 2);
  }, [purchaseHistories]);

  const inboxItemCount = useMemo(() => {
    return items.filter((item) => {
      return (
        item.status === "미완료" &&
        !item.dueDate &&
        !item.reminderDate &&
        !item.scheduleStartTime &&
        item.processType !== "아이디어"
      );
    }).length;
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => matchesFilter(item, selectedFilter));
  }, [items, selectedFilter]);

  async function handleClassify(textOverride?: string) {
    const targetText = textOverride ?? inputText;
    const trimmedText = targetText.trim();

    if (!trimmedText) {
      alert("먼저 기록할 내용을 입력해주세요.");
      return;
    }

    if (textOverride !== undefined) {
      setInputText(targetText);
    }

    setIsClassifying(true);
    setClassificationSource(null);

    try {
      const classificationContext = buildClassificationContext({
        inputText: trimmedText,
        items,
        userProfile,
        personalAiMemories: getPersonalAiMemories(),
      });
      const { result, source } = await aiClassifyInput(
        trimmedText,
        classificationContext
      );

      setClassificationResult(result);
      setClassificationSource(source);
    } catch (error) {
      console.error("AI 분류 실패, 규칙 기반 분류로 대체:", error);

      const fallbackResult = classifyInput(trimmedText);

      setClassificationResult(fallbackResult);
      setClassificationSource("fallback");
    } finally {
      setIsClassifying(false);
    }
  }

  async function handleSave() {
    if (!classificationResult) return;

    const now = new Date().toISOString();
    const ideaGrouping = shouldAttachToIdeaRecord(classificationResult)
      ? await groupIdeaWithAi({
        text: classificationResult.originalText,
        existingIdeas: items,
        personalAiMemories: getPersonalAiMemories(),
      })
      : null;

    const newItem: AssistantItem = {
      ...classificationResult,
      ideaGroupId: ideaGrouping?.ideaGroupId ?? classificationResult.ideaGroupId,
      ideaGroupTitle:
        ideaGrouping?.ideaGroupTitle ?? classificationResult.ideaGroupTitle,
      ideaSubcategory:
        ideaGrouping?.ideaSubcategory ?? classificationResult.ideaSubcategory,
      id: createId(),
      createdAt: now,
      updatedAt: now,
    };

    saveItem(newItem);

    const singleSchedule = createSingleScheduleFromItem(newItem);

    if (singleSchedule) {
      saveSingleSchedule(singleSchedule);
      setSingleSchedules(getSingleSchedules());
    }

    setItems(getItems());
    setInputText("");
    setClassificationResult(null);
    setClassificationSource(null);
  }

  function handleComplete(item: AssistantItem) {
    const updatedItem: AssistantItem = {
      ...item,
      status: "완료",
      updatedAt: new Date().toISOString(),
    };

    updateItem(updatedItem);
    setItems(getItems());
  }

  function handleDelete(id: string) {
    deleteItem(id);
    setItems(getItems());
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
  }

  return (
    <main className="mx-auto min-h-screen max-w-[1440px] px-0 py-0 sm:px-5 sm:py-6 md:px-6 md:pl-[7.5rem] xl:grid xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)] xl:items-start xl:gap-5 xl:px-6 xl:pl-[7.5rem]">
      <section className="hidden">
        <p className="text-sm font-black text-blue-600">나를 위한 AI 비서</p>
        <div className="mt-4 flex items-center gap-4">
          <h1 className="text-5xl font-black tracking-tight text-slate-950 md:text-6xl">
            나의 비서
          </h1>
          <div className="grid h-16 w-20 place-items-center rounded-[28px] bg-gradient-to-b from-blue-200 to-blue-500 shadow-[0_18px_35px_rgba(49,130,246,0.24)]">
            <div className="flex gap-2">
              <span className="h-2 w-2 rounded-full bg-slate-800" />
              <span className="h-2 w-2 rounded-full bg-slate-800" />
            </div>
          </div>
        </div>
        <p className="mt-6 max-w-md text-base leading-8 text-slate-500">
          생각을 입력하고, AI가 정리해주고, 일정을 관리하고, 필요한 순간에
          알려드려요.
        </p>

        <div className="mt-6 rounded-[28px] bg-white/78 p-4 shadow-soft ring-1 ring-slate-100">
          <p className="text-sm font-black text-slate-900">빠른 음성 기록</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            iPhone 단축어, 동작 버튼, 뒷면 탭에서 앱 주소 뒤에{" "}
            <span className="font-black text-blue-600">?voice=1</span>을 붙여
            열면 바로 음성 기록 화면으로 진입할 수 있습니다.
          </p>
        </div>

        <div className="mt-10 space-y-6">
          {[
            ["AI가 똑똑하게 정리해줘요", "복잡한 생각도 AI가 할 일, 일정, 아이디어로 알아서 분류해줘요."],
            ["일정을 한눈에 관리해요", "월간, 주간 캘린더로 정기 일정과 단기 일정을 쉽게 확인할 수 있어요."],
            ["중요한 순간을 놓치지 않아요", "필요한 시간에 알림을 보내도록 확장할 준비가 되어 있어요."],
          ].map(([title, body], index) => (
            <div key={title} className="flex gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-blue-600 shadow-soft ring-1 ring-slate-100">
                <span className="text-lg font-black">{index + 1}</span>
              </div>
              <div>
                <h2 className="font-black text-slate-900">{title}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="home-workspace mx-auto min-h-screen w-full bg-white px-4 pb-0 pt-[max(1rem,env(safe-area-inset-top))] sm:phone-shell sm:min-h-0 sm:max-w-[430px] sm:overflow-hidden sm:p-4 md:max-w-none md:overflow-visible md:bg-transparent md:p-0 md:shadow-none">
        <div className="flex items-center justify-between px-1 pb-5 pt-1 text-xs font-black text-slate-900 md:hidden">
          <span>9:41</span>
        </div>

        <header className="flex items-start justify-between md:rounded-3xl md:bg-white md:px-6 md:py-5 md:shadow-soft md:ring-1 md:ring-slate-100">
          <div>
            <p className="mb-1 hidden text-sm font-black text-blue-600 md:block">
              나를 위한 AI 비서 · 나의 비서
            </p>
            <p className="text-xs font-bold text-slate-400">
              안녕하세요, {userProfile?.displayName ?? "사용자"}님
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
              오늘도 잘 부탁해요!
            </h2>
            <nav className="mt-4 hidden flex-wrap items-center gap-x-5 gap-y-2 md:flex" aria-label="주요 서비스">
              {[
                ["월간 캘린더", "/calendar/monthly"],
                ["일정관리", "/schedule/manage"],
                ["기록", "/records"],
                ["위임", "/delegate"],
                ["개인 AI", "/settings/ai"],
              ].map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  className="text-sm font-black text-slate-500 transition hover:text-blue-600"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <UserStatusBadge />
            <div className="grid h-9 w-9 place-items-center rounded-2xl bg-slate-50 text-slate-700 ring-1 ring-slate-100">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />
              </svg>
            </div>
          </div>
        </header>

        <div className="mt-5 space-y-4 md:grid md:grid-cols-12 md:items-start md:gap-5 md:space-y-0">
          <section className="app-card p-4 md:order-2 md:col-span-4 md:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black text-blue-600">오늘 액션</p>
                <h3 className="mt-1 text-lg font-black text-slate-950">
                  {nextTodaySchedule
                    ? `${nextTodaySchedule.time} ${nextTodaySchedule.title}`
                    : todayItems.length > 0
                    ? "먼저 확인할 기록이 있어요"
                    : "오늘 예정된 액션이 없어요"}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">
                  {nextTodaySchedule
                    ? nextTodaySchedule.detail
                    : todayItems.length > 0
                    ? `${todayItems.length}개의 중요한 기록을 오늘 처리하면 좋아요.`
                    : "생각나는 일을 말하거나 적으면 일정, 할 일, 아이디어로 정리해둘게요."}
                </p>
              </div>
              <Link
                href="/calendar/weekly"
                className="shrink-0 rounded-full bg-blue-600 px-3 py-2 text-xs font-black text-white shadow-[0_10px_24px_rgba(49,130,246,0.22)]"
              >
                캘린더
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2">
              {[
                ["일정", todayScheduleItems.length, "/calendar/monthly"],
                ["중요", todayItems.length, "/records"],
                ["메모", openMemoCount, "/records"],
                ["위임", pendingAgentCount, "/delegate"],
              ].map(([label, count, href]) => (
                <Link
                  key={label}
                  href={String(href)}
                  className="rounded-2xl bg-slate-50 px-2 py-3 text-center ring-1 ring-slate-100"
                >
                  <p className="text-base font-black text-slate-950">
                    {count}
                  </p>
                  <p className="mt-0.5 text-[11px] font-black text-slate-400">
                    {label}
                  </p>
                </Link>
              ))}
            </div>

            {inboxItemCount > 0 && (
              <Link
                href="/records"
                className="mt-3 flex items-center justify-between rounded-2xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-700 ring-1 ring-amber-100"
              >
                <span>분류만 되고 날짜가 없는 기록 {inboxItemCount}개</span>
                <span>정리하기</span>
              </Link>
            )}

            {dueRepurchaseItems.length > 0 && (
              <div className="mt-3 rounded-2xl bg-emerald-50 p-3 ring-1 ring-emerald-100">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black text-emerald-700">
                      재구매 추천
                    </p>
                    <p className="mt-0.5 text-[11px] font-bold text-emerald-600">
                      메일에서 확인한 주기를 기준으로 알려드려요.
                    </p>
                  </div>
                  <Link
                    href="/purchase"
                    className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-emerald-700 ring-1 ring-emerald-100"
                  >
                    관리
                  </Link>
                </div>
                <div className="mt-3 grid gap-2">
                  {dueRepurchaseItems.map((history) => (
                    <div
                      key={history.id}
                      className="rounded-2xl bg-white p-3 ring-1 ring-emerald-100"
                    >
                      <p className="truncate text-sm font-black text-slate-900">
                        {history.productName}
                      </p>
                      <p className="mt-1 text-[11px] font-bold text-slate-400">
                        {history.repeatCycleDays
                          ? `${history.repeatCycleDays}일 주기`
                          : "구매 주기 확인 필요"}
                        {history.maxBudgetKrw
                          ? ` · ${history.maxBudgetKrw.toLocaleString()}원`
                          : ""}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <a
                          href={
                            history.productUrl ||
                            `https://www.coupang.com/np/search?q=${encodeURIComponent(
                              history.productName
                            )}`
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full bg-emerald-600 px-3 py-2 text-center text-xs font-black text-white"
                        >
                          쿠팡 열기
                        </a>
                        <button
                          type="button"
                          onClick={() => postponeRepurchase(history)}
                          className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 ring-1 ring-emerald-100"
                        >
                          다음에
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <div className="space-y-4 md:order-1 md:col-span-8">
            <InputBox
              value={inputText}
              onChange={setInputText}
              onClassify={handleClassify}
              voiceIntent={voiceIntent}
            />

            {isClassifying && (
            <p className="app-card p-4 text-sm font-black text-slate-500">
              AI가 입력 내용을 분류하는 중입니다...
            </p>
            )}

            {classificationSource === "ai" && (
            <p className="rounded-3xl bg-emerald-50 p-4 text-sm font-black text-emerald-700 ring-1 ring-emerald-100">
              AI API로 분류했습니다.
            </p>
            )}

            {classificationSource === "gemma-on-device" && (
            <p className="rounded-3xl bg-blue-50 p-4 text-sm font-black text-blue-700 ring-1 ring-blue-100">
              기기의 Gemma 전문가가 분류했습니다.
            </p>
            )}

            {classificationSource === "fallback" && (
            <p className="rounded-3xl bg-amber-50 p-4 text-sm font-black text-amber-700 ring-1 ring-amber-100">
              AI 분류를 사용할 수 없어 규칙 기반 분류를 사용했습니다.
            </p>
            )}

            {classificationResult ? (
            <ClassificationResult
              result={classificationResult}
              onChange={setClassificationResult}
              onSave={handleSave}
            />
            ) : (
            <section className="app-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-slate-900">오늘의 작업함</h3>
                  <p className="mt-1 text-xs font-bold leading-5 text-slate-400">
                    일정, 기록, 위임에서 오늘 확인할 핵심만 함께 보여줍니다.
                  </p>
                </div>
              </div>

              <div className="grid gap-2">
                {[
                  {
                    title: "오늘 일정",
                    count: todayScheduleItems.length,
                    body: nextTodaySchedule
                      ? `${nextTodaySchedule.time} ${nextTodaySchedule.title}`
                      : "확정 일정 없음",
                    href: "/calendar/weekly",
                    tone: "blue",
                  },
                  {
                    title: "정리할 기록",
                    count: inboxItemCount,
                    body:
                      inboxItemCount > 0
                        ? "날짜나 다음 행동이 아직 비어 있어요."
                        : "지금은 비어 있어요.",
                    href: "/records",
                    tone: "amber",
                  },
                  {
                    title: "즉시처리",
                    count: pendingAgentCount,
                    body:
                      pendingAgentCount > 0
                        ? "구매, 예약처럼 확인이 필요한 요청입니다."
                        : "대기 중인 위임 요청 없음",
                    href: "/records",
                    tone: "violet",
                  },
                ].map((card) => (
                  <Link
                    key={card.title}
                    href={card.href}
                    className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100"
                  >
                    <span
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-sm font-black ${
                        card.tone === "blue"
                          ? "bg-blue-100 text-blue-600"
                          : card.tone === "amber"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-violet-100 text-violet-600"
                      }`}
                    >
                      {card.count}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black text-slate-900">
                        {card.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs font-semibold text-slate-400">
                        {card.body}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
            )}
          </div>

          <div className="space-y-4 md:order-3 md:col-span-12 md:grid md:grid-cols-2 md:gap-5 md:space-y-0">
            <AgentActionSuggestionView items={items} compact maxItems={2} />
            <NotificationSummaryCard />
          </div>
        </div>

        <BottomNavigation />
      </section>

      <section className="hidden self-start md:mt-5 md:block xl:sticky xl:top-6 xl:mt-0">
        <section className="app-card p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-900">저장된 기록</h2>
              <p className="mt-1 text-sm text-slate-500">
                총 {items.length}개의 기록이 저장되어 있습니다.
              </p>
            </div>

            <FilterBar
              selectedFilter={selectedFilter}
              onChange={setSelectedFilter}
            />
          </div>

          {filteredItems.length === 0 ? (
            <div className="rounded-[24px] bg-slate-50 p-5 text-sm leading-6 text-slate-500">
              아직 저장된 기록이 없습니다. 휴대폰 화면에서 생각을 입력해
              분류하고 저장해보세요.
            </div>
          ) : (
            <div className="grid max-h-[720px] gap-4 overflow-auto pr-1">
              {filteredItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onComplete={handleComplete}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
