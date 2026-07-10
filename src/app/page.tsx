"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BottomNavigation from "@/components/BottomNavigation";
import AgentActionSuggestionView from "@/components/AgentActionSuggestionView";
import ClassificationResult from "@/components/ClassificationResult";
import FilterBar from "@/components/FilterBar";
import InputBox from "@/components/InputBox";
import ItemCard from "@/components/ItemCard";
import TimeTaskSuggestionView from "@/components/TimeTaskSuggestionView";
import UserStatusBadge from "@/components/UserStatusBadge";
import { aiClassifyInput } from "@/lib/aiClassifyInput";
import { classifyInput } from "@/lib/classifyInput";
import { buildClassificationContext } from "@/lib/classificationContext";
import { getCloudDataSyncedEventName } from "@/lib/dataSyncEvents";
import { getLocalDataUpdatedEventName } from "@/lib/localStorageRepository";
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
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("전체");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const [isClassifying, setIsClassifying] = useState(false);
  const [classificationSource, setClassificationSource] = useState<
    "ai" | "fallback" | null
  >(null);
  const [voiceIntent, setVoiceIntent] = useState(false);

  useEffect(() => {
    function refreshLocalData() {
      setItems(getItems());
      setRoutines(getRoutineSchedules());
      setSingleSchedules(getSingleSchedules());
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

  const pendingTimeTaskCount = useMemo(() => {
    return items.filter((item) => {
      return (
        item.status === "미완료" &&
        (item.processType === "시간작업" || item.actionType === "예약")
      );
    }).length;
  }, [items]);

  const pendingAgentCount = useMemo(() => {
    return items.filter((item) => {
      return (
        item.status === "미완료" &&
        (item.processType === "에이전트위임" ||
          item.actionType === "구매" ||
          item.actionType === "예약")
      );
    }).length;
  }, [items]);

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

  function handleSave() {
    if (!classificationResult) return;

    const now = new Date().toISOString();

    const newItem: AssistantItem = {
      ...classificationResult,
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

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-0 py-0 sm:px-5 sm:py-6 lg:grid lg:grid-cols-[0.8fr_430px_1fr] lg:items-center lg:gap-10 lg:px-10">
      <section className="hidden self-center lg:block lg:pr-4">
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

      <section className="mx-auto min-h-screen w-full bg-white px-4 pb-0 pt-[max(1rem,env(safe-area-inset-top))] sm:phone-shell sm:min-h-0 sm:max-w-[430px] sm:overflow-hidden sm:p-4">
        <div className="flex items-center justify-between px-1 pb-5 pt-1 text-xs font-black text-slate-900">
          <span>9:41</span>
        </div>

        <header className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400">
              안녕하세요, {userProfile?.displayName ?? "사용자"}님
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
              오늘도 잘 부탁해요!
            </h2>
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

        <div className="mt-6 space-y-4">
          <section className="app-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black text-blue-600">오늘 액션</p>
                <h3 className="mt-1 text-lg font-black text-slate-950">
                  {nextTodaySchedule
                    ? `${nextTodaySchedule.time} ${nextTodaySchedule.title}`
                    : todayItems.length > 0
                    ? "먼저 확인할 기록이 있어요"
                    : "바로 기록해도 좋아요"}
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
                href="/schedule/manage"
                className="shrink-0 rounded-full bg-blue-600 px-3 py-2 text-xs font-black text-white shadow-[0_10px_24px_rgba(49,130,246,0.22)]"
              >
                일정관리
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2">
              {[
                ["일정", todayScheduleItems.length, "/calendar/monthly"],
                ["중요", todayItems.length, "/records"],
                ["추천", pendingTimeTaskCount, "/calendar/weekly"],
                ["준비", pendingAgentCount, "/records"],
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
          </section>

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
                <h3 className="font-black text-slate-900">오늘의 일정</h3>
                <Link href="/calendar/monthly" className="text-xs font-black text-slate-400">
                  전체 보기
                </Link>
              </div>

              <div className="space-y-2">
                {todayScheduleItems.length === 0 && todayItems.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-500">
                    오늘 확정된 일정은 아직 없어요. 떠오른 일을 바로 입력하거나
                    일정관리에서 시간을 잡아둘 수 있어요.
                  </div>
                ) : (
                  (todayScheduleItems.length > 0
                    ? todayScheduleItems.slice(0, 3)
                    : todayItems.slice(0, 3).map((item) => ({
                      time: item.scheduleStartTime ?? item.dueDate ?? "오늘",
                      title: item.title,
                      detail: item.originalText,
                      tag: item.processType,
                    }))
                  ).map((schedule) => (
                    <div key={`${schedule.time}-${schedule.title}`} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-3 ring-1 ring-slate-100">
                      <span className="w-12 text-sm font-black text-slate-900">{schedule.time}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-slate-900">{schedule.title}</p>
                        <p className="mt-0.5 truncate text-xs font-semibold text-slate-400">{schedule.detail}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-black ${
                        schedule.tag === "단기" || schedule.tag === "단기일정"
                          ? "bg-blue-50 text-blue-600"
                          : "bg-emerald-50 text-emerald-600"
                      }`}>
                        {schedule.tag}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          <TimeTaskSuggestionView
            items={items}
            routines={routines}
            singleSchedules={singleSchedules}
            compact
            maxItems={2}
          />

          <AgentActionSuggestionView items={items} compact maxItems={2} />
        </div>

        <BottomNavigation />
      </section>

      <section className="hidden self-center lg:block lg:pl-4">
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
