"use client";

import { useEffect, useMemo, useState } from "react";
import BottomNavigation from "@/components/BottomNavigation";
import SettingsPageHeader from "@/components/SettingsPageHeader";
import { getCloudDataSyncedEventName } from "@/lib/dataSyncEvents";
import { getLocalDataUpdatedEventName } from "@/lib/localStorageRepository";
import {
  clearPersonalAiFeedbackMemories,
  deletePersonalAiMemory,
  getPersonalAiMemories,
} from "@/lib/personalAiMemoryStorage";
import {
  clearSuggestionFeedbacks,
  deleteSuggestionFeedback,
  getSuggestionFeedbacks,
} from "@/lib/suggestionFeedbackStorage";
import type {
  PersonalAiMemory,
  PersonalAiMemoryDomain,
} from "@/types/personalAi";
import type { SuggestionFeedback } from "@/types/suggestionFeedback";

const DOMAIN_LABELS: Record<PersonalAiMemoryDomain, string> = {
  classification: "작업 분류",
  idea: "아이디어 연결",
  schedule: "시간 배치",
  purchase: "재구매",
  notification: "알림",
};

const FEEDBACK_LABELS: Record<SuggestionFeedback["feedbackType"], string> = {
  good: "좋음",
  bad: "별로",
  wrong_place: "장소 아님",
};

function formatDate(value: string) {
  if (!value) return "시각 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function PersonalAiHistoryPage() {
  const [memories, setMemories] = useState<PersonalAiMemory[]>([]);
  const [suggestionFeedbacks, setSuggestionFeedbacks] = useState<
    SuggestionFeedback[]
  >([]);
  const [domain, setDomain] = useState<PersonalAiMemoryDomain | "all">("all");

  function refresh() {
    setMemories(getPersonalAiMemories());
    setSuggestionFeedbacks(getSuggestionFeedbacks());
  }

  useEffect(() => {
    refresh();
    window.addEventListener(getLocalDataUpdatedEventName(), refresh);
    window.addEventListener(getCloudDataSyncedEventName(), refresh);
    return () => {
      window.removeEventListener(getLocalDataUpdatedEventName(), refresh);
      window.removeEventListener(getCloudDataSyncedEventName(), refresh);
    };
  }, []);

  const filteredMemories = useMemo(() => {
    return memories.filter((memory) => domain === "all" || memory.domain === domain);
  }, [domain, memories]);
  const feedbackMemoryCount = memories.filter(
    (memory) => memory.source === "feedback"
  ).length;

  function removeMemory(memory: PersonalAiMemory) {
    if (!window.confirm(`“${memory.title}” 기억을 삭제할까요?`)) return;
    deletePersonalAiMemory(memory.id);
    refresh();
  }

  function clearClassificationHistory() {
    if (!window.confirm("사용자가 가르친 분류 기록을 모두 삭제할까요?")) return;
    clearPersonalAiFeedbackMemories();
    refresh();
  }

  function clearScheduleHistory() {
    if (!window.confirm("시간 추천 평가 기록을 모두 삭제할까요?")) return;
    clearSuggestionFeedbacks();
    refresh();
  }

  return (
    <main className="app-page mx-auto max-w-5xl px-4">
      <SettingsPageHeader
        title="개인 AI 학습 기록"
        description="Gemma와 추천 엔진이 다음 판단에 참고하는 내 기준을 확인하고 직접 관리합니다."
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="app-card p-4">
          <p className="text-xs font-black text-slate-400">내가 가르친 분류</p>
          <p className="mt-2 text-3xl font-black text-slate-950">
            {feedbackMemoryCount}
          </p>
        </div>
        <div className="app-card p-4">
          <p className="text-xs font-black text-slate-400">시간 추천 평가</p>
          <p className="mt-2 text-3xl font-black text-slate-950">
            {suggestionFeedbacks.length}
          </p>
        </div>
        <div className="app-card p-4">
          <p className="text-xs font-black text-slate-400">적용 영역</p>
          <p className="mt-2 text-3xl font-black text-slate-950">5</p>
        </div>
      </section>

      <p className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm font-bold leading-6 text-blue-800 ring-1 ring-blue-100">
        현재 학습은 모델 파일을 다시 훈련하는 방식이 아니라, 확인한 분류와 추천
        평가를 개인 AI 메모리로 저장해 다음 판단에 우선 반영하는 방식입니다.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <section className="app-card p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900">개인 AI 기억</h2>
              <p className="mt-1 text-sm text-slate-500">
                기본 원칙과 분류 결과를 수정하며 알려준 내용을 함께 보여줍니다.
              </p>
            </div>
            {feedbackMemoryCount > 0 && (
              <button
                type="button"
                onClick={clearClassificationHistory}
                className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-600 ring-1 ring-rose-100"
              >
                분류 학습 초기화
              </button>
            )}
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {(["all", ...Object.keys(DOMAIN_LABELS)] as Array<
              PersonalAiMemoryDomain | "all"
            >).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setDomain(item)}
                className={`shrink-0 rounded-full px-3 py-2 text-xs font-black ${
                  domain === item
                    ? "bg-slate-950 text-white"
                    : "bg-slate-50 text-slate-500 ring-1 ring-slate-100"
                }`}
              >
                {item === "all" ? "전체" : DOMAIN_LABELS[item]}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            {filteredMemories.map((memory) => (
              <article
                key={memory.id}
                className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-blue-600 ring-1 ring-blue-100">
                        {DOMAIN_LABELS[memory.domain]}
                      </span>
                      <span className="text-[11px] font-bold text-slate-400">
                        {memory.source === "system" ? "기본 원칙" : "내 피드백"}
                      </span>
                    </div>
                    <h3 className="mt-2 text-sm font-black text-slate-900">
                      {memory.title}
                    </h3>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                      {memory.summary}
                    </p>
                  </div>
                  {memory.source !== "system" && (
                    <button
                      type="button"
                      onClick={() => removeMemory(memory)}
                      aria-label={`${memory.title} 삭제`}
                      title="학습 기록 삭제"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-lg text-rose-500 ring-1 ring-rose-100"
                    >
                      ×
                    </button>
                  )}
                </div>
                <ul className="mt-3 space-y-1.5">
                  {memory.rules.map((rule) => (
                    <li key={rule} className="text-xs font-bold leading-5 text-slate-700">
                      · {rule}
                    </li>
                  ))}
                </ul>
                {memory.examples.length > 0 && (
                  <p className="mt-3 rounded-xl bg-white p-3 text-xs font-semibold text-slate-500">
                    실제 입력: {memory.examples.join(" · ")}
                  </p>
                )}
                {memory.source !== "system" && (
                  <p className="mt-2 text-[11px] font-bold text-slate-400">
                    마지막 반영 {formatDate(memory.updatedAt)}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="app-card self-start p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900">시간 추천 평가</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                좋음·별로·장소 아님 선택이 이후 추천 점수에 반영됩니다.
              </p>
            </div>
            {suggestionFeedbacks.length > 0 && (
              <button
                type="button"
                onClick={clearScheduleHistory}
                className="shrink-0 rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-600"
              >
                전체 삭제
              </button>
            )}
          </div>

          <div className="mt-4 space-y-2">
            {suggestionFeedbacks.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-500">
                아직 평가한 시간 추천이 없습니다.
              </p>
            ) : (
              suggestionFeedbacks.map((feedback) => (
                <article
                  key={feedback.id}
                  className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100"
                >
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-blue-600 ring-1 ring-blue-100">
                    {FEEDBACK_LABELS[feedback.feedbackType]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-900">
                      {feedback.itemTitle}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {feedback.suggestionDate} · {feedback.suggestionStartTime} - {feedback.suggestionEndTime}
                    </p>
                    {feedback.placeName && (
                      <p className="mt-1 truncate text-xs font-semibold text-slate-400">
                        {feedback.placeName}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteSuggestionFeedback(feedback.id)}
                    aria-label={`${feedback.itemTitle} 평가 삭제`}
                    title="평가 삭제"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-base text-rose-500 ring-1 ring-rose-100"
                  >
                    ×
                  </button>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
      <BottomNavigation />
    </main>
  );
}
