"use client";

import { useEffect, useState } from "react";
import { suggestTimeTaskSchedules } from "@/lib/taskScheduleSuggestion";
import { getCloudDataSyncedEventName } from "@/lib/dataSyncEvents";
import { getLocalDataUpdatedEventName } from "@/lib/localStorageRepository";
import { getSavedPlaces } from "@/lib/placeStorage";
import { getPersonalAiMemories } from "@/lib/personalAiMemoryStorage";
import {
  getSingleSchedules,
  saveSingleSchedule,
  updateSingleSchedule,
} from "@/lib/singleScheduleStorage";
import {
  getSuggestionFeedbacks,
  saveSuggestionFeedbackForSuggestion,
} from "@/lib/suggestionFeedbackStorage";
import { updateItem } from "@/lib/storage";
import { getUserProfile } from "@/lib/userProfileStorage";
import { AssistantItem } from "@/types/assistant";
import { SavedPlace, SingleSchedule } from "@/types/calendar";
import { RoutineSchedule } from "@/types/routine";
import type {
  SuggestionFeedback,
  SuggestionFeedbackType,
} from "@/types/suggestionFeedback";
import { UserProfile } from "@/types/userProfile";
import type { PersonalAiMemory } from "@/types/personalAi";

type TimeTaskSuggestionViewProps = {
  items: AssistantItem[];
  routines: RoutineSchedule[];
  singleSchedules: SingleSchedule[];
  compact?: boolean;
  maxItems?: number;
};

export default function TimeTaskSuggestionView({
  items,
  routines,
  singleSchedules,
  compact = false,
  maxItems,
}: TimeTaskSuggestionViewProps) {
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [suggestionFeedbacks, setSuggestionFeedbacks] = useState<
    SuggestionFeedback[]
  >([]);
  const [personalAiMemories, setPersonalAiMemories] = useState<
    PersonalAiMemory[]
  >([]);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [editingSuggestionId, setEditingSuggestionId] = useState<string | null>(
    null
  );
  const [draftSuggestion, setDraftSuggestion] = useState({
    title: "",
    date: "",
    startTime: "",
    endTime: "",
    placeName: "",
  });

  useEffect(() => {
    function refreshRecommendationContext() {
      setSavedPlaces(getSavedPlaces());
      setUserProfile(getUserProfile());
    setSuggestionFeedbacks(getSuggestionFeedbacks());
    setPersonalAiMemories(getPersonalAiMemories());
  }

    refreshRecommendationContext();
    window.addEventListener(
      getCloudDataSyncedEventName(),
      refreshRecommendationContext
    );
    window.addEventListener(
      getLocalDataUpdatedEventName(),
      refreshRecommendationContext
    );

    return () => {
      window.removeEventListener(
        getCloudDataSyncedEventName(),
        refreshRecommendationContext
      );
      window.removeEventListener(
        getLocalDataUpdatedEventName(),
        refreshRecommendationContext
      );
    };
  }, []);

  const suggestions = suggestTimeTaskSchedules({
    items,
    routines,
    singleSchedules,
    savedPlaces,
    userProfile,
    suggestionFeedbacks,
    personalAiMemories,
  });
  const visibleSuggestions =
    typeof maxItems === "number" ? suggestions.slice(0, maxItems) : suggestions;

  const timeTasks = items.filter((item) => {
    return (
      item.status === "미완료" &&
      (item.processType === "시간작업" || item.actionType === "예약")
    );
  });

  function handleFeedback(
    suggestion: (typeof suggestions)[number],
    feedbackType: SuggestionFeedbackType
  ) {
    saveSuggestionFeedbackForSuggestion({
      suggestion,
      feedbackType,
    });
    setSuggestionFeedbacks(getSuggestionFeedbacks());
    setFeedbackMessage(
      feedbackType === "good"
        ? "좋은 추천으로 기억해둘게요."
        : feedbackType === "wrong_place"
          ? "이 장소는 다음 추천에서 덜 사용하도록 기억해둘게요."
          : "비슷한 추천은 점수를 낮춰볼게요."
    );
  }

  function createId() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function getSuggestionKey(suggestion: (typeof suggestions)[number]) {
    return `${suggestion.itemId}-${suggestion.date}-${suggestion.startTime}`;
  }

  function startEditingSuggestion(suggestion: (typeof suggestions)[number]) {
    setEditingSuggestionId(getSuggestionKey(suggestion));
    setDraftSuggestion({
      title: suggestion.title,
      date: suggestion.date,
      startTime: suggestion.startTime,
      endTime: suggestion.endTime,
      placeName: suggestion.placeName ?? "",
    });
  }

  function confirmSuggestion(suggestion: (typeof suggestions)[number]) {
    const sourceItem = items.find((item) => item.id === suggestion.itemId);
    const isEditing = editingSuggestionId === getSuggestionKey(suggestion);
    const title = isEditing ? draftSuggestion.title.trim() : suggestion.title;
    const date = isEditing ? draftSuggestion.date : suggestion.date;
    const startTime = isEditing ? draftSuggestion.startTime : suggestion.startTime;
    const endTime = isEditing ? draftSuggestion.endTime : suggestion.endTime;
    const placeName = isEditing
      ? draftSuggestion.placeName.trim()
      : suggestion.placeName ?? "";

    if (!title || !date || !startTime || !endTime) {
      setFeedbackMessage("확정하려면 제목, 날짜, 시작/종료 시간이 필요해요.");
      return;
    }

    const now = new Date().toISOString();

    const nextSchedule: SingleSchedule = {
      id: createId(),
      title,
      date,
      startTime,
      endTime,
      placeName,
      memo: suggestion.reason,
      color: sourceItem?.color,
      sourceItemId: suggestion.itemId,
      createdAt: now,
      updatedAt: now,
    };
    const existingSchedule = getSingleSchedules().find((schedule) => {
      if (schedule.sourceItemId !== suggestion.itemId) return false;

      return sourceItem?.processType === "시간작업"
        ? schedule.date === date && schedule.startTime === startTime
        : true;
    });

    if (existingSchedule) {
      updateSingleSchedule({
        ...nextSchedule,
        id: existingSchedule.id,
        createdAt: existingSchedule.createdAt,
      });
    } else {
      saveSingleSchedule(nextSchedule);
    }

    if (sourceItem) {
      updateItem(
        sourceItem.processType === "시간작업"
          ? {
              ...sourceItem,
              title,
              updatedAt: now,
            }
          : {
              ...sourceItem,
              title,
              dueDate: date,
              scheduleStartTime: startTime,
              scheduleEndTime: endTime,
              status: "완료",
              updatedAt: now,
            }
      );
    }

    setEditingSuggestionId(null);
    setFeedbackMessage(
      existingSchedule
        ? "기존 배치 시간을 수정했어."
        : sourceItem?.processType === "시간작업"
          ? "이 회차를 캘린더에 배치했어. 남은 분량만 다시 추천할게."
          : "추천을 확정해서 단기 일정에 저장했어."
    );
  }

  function getCurrentFeedback(suggestion: (typeof suggestions)[number]) {
    return suggestionFeedbacks.find((feedback) => {
      return (
        feedback.itemId === suggestion.itemId &&
        feedback.suggestionDate === suggestion.date &&
        feedback.suggestionStartTime === suggestion.startTime &&
        feedback.suggestionEndTime === suggestion.endTime &&
        (feedback.placeName ?? "") === (suggestion.placeName ?? "")
      );
    });
  }

  function FeedbackButtons({
    suggestion,
    small = false,
  }: {
    suggestion: (typeof suggestions)[number];
    small?: boolean;
  }) {
    const currentFeedback = getCurrentFeedback(suggestion);
    const buttons: Array<{
      type: SuggestionFeedbackType;
      label: string;
    }> = [
      { type: "good", label: "좋음" },
      { type: "bad", label: "별로" },
      { type: "wrong_place", label: "장소 아님" },
    ];

    return (
      <div className={`flex flex-wrap gap-1.5 ${small ? "mt-2" : "mt-4"}`}>
        {buttons.map((button) => {
          const isActive = currentFeedback?.feedbackType === button.type;

          return (
            <button
              key={`${suggestion.itemId}-${button.type}`}
              type="button"
              onClick={() => handleFeedback(suggestion, button.type)}
              className={`rounded-full px-3 py-1 text-[11px] font-black transition ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-500 ring-1 ring-slate-100 hover:text-blue-600"
              }`}
            >
              {button.label}
            </button>
          );
        })}
      </div>
    );
  }

  if (compact) {
    return (
      <section className="app-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-black text-slate-900">AI 추천 배치</h3>
          <span className="text-xs font-black text-slate-400">
            {suggestions.length}개
          </span>
        </div>

        {timeTasks.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-500">
            시간작업이나 예약할 일이 생기면 빈 시간에 맞춰 추천해드릴게요.
          </p>
        ) : suggestions.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-500">
            추천할 일은 있지만 이번 주 빈 시간 안에 넣을 자리를 찾지 못했어요.
          </p>
        ) : (
          <div className="space-y-2">
            {visibleSuggestions.map((suggestion) => (
              <article
                key={getSuggestionKey(suggestion)}
                className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-blue-100 text-blue-600">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M5 5h14v14H5zM8 8h3v8H8zM13 8h3v8h-3z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-slate-900">
                    {suggestion.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs font-semibold text-slate-400">
                    {suggestion.date} {suggestion.dayOfWeek}요일{" "}
                    {suggestion.startTime} ~ {suggestion.endTime}
                  </p>
                  {suggestion.sessionIndex && suggestion.sessionCount && (
                    <p className="mt-0.5 truncate text-xs font-black text-indigo-500">
                      목표 {suggestion.sessionIndex}/{suggestion.sessionCount}
                      {suggestion.allocatedAmount && suggestion.workloadUnit
                        ? ` · 약 ${suggestion.allocatedAmount}${suggestion.workloadUnit}`
                        : ""}
                    </p>
                  )}
                  {suggestion.placeName && (
                    <p className="mt-0.5 truncate text-xs font-black text-blue-500">
                      {suggestion.placeName} 기준
                    </p>
                  )}
                  <FeedbackButtons suggestion={suggestion} small />
                  <div className="mt-2 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => confirmSuggestion(suggestion)}
                      className="rounded-full bg-blue-600 px-3 py-1 text-[11px] font-black text-white"
                    >
                      확정
                    </button>
                    <button
                      type="button"
                      onClick={() => startEditingSuggestion(suggestion)}
                      className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-slate-500 ring-1 ring-slate-100"
                    >
                      수정
                    </button>
                  </div>
                  {editingSuggestionId === getSuggestionKey(suggestion) && (
                    <div className="mt-2 grid gap-1.5">
                      <input
                        value={draftSuggestion.title}
                        onChange={(event) =>
                          setDraftSuggestion((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                        className="rounded-xl border border-slate-200 px-2 py-1.5 text-xs font-bold outline-none focus:border-blue-400"
                        placeholder="제목"
                      />
                      <div className="grid grid-cols-3 gap-1.5">
                        <input
                          type="date"
                          value={draftSuggestion.date}
                          onChange={(event) =>
                            setDraftSuggestion((current) => ({
                              ...current,
                              date: event.target.value,
                            }))
                          }
                          className="rounded-xl border border-slate-200 px-2 py-1.5 text-xs font-bold outline-none focus:border-blue-400"
                        />
                        <input
                          type="time"
                          value={draftSuggestion.startTime}
                          onChange={(event) =>
                            setDraftSuggestion((current) => ({
                              ...current,
                              startTime: event.target.value,
                            }))
                          }
                          className="rounded-xl border border-slate-200 px-2 py-1.5 text-xs font-bold outline-none focus:border-blue-400"
                        />
                        <input
                          type="time"
                          value={draftSuggestion.endTime}
                          onChange={(event) =>
                            setDraftSuggestion((current) => ({
                              ...current,
                              endTime: event.target.value,
                            }))
                          }
                          className="rounded-xl border border-slate-200 px-2 py-1.5 text-xs font-bold outline-none focus:border-blue-400"
                        />
                      </div>
                    </div>
                  )}
                </div>
                <span className="text-xs font-black text-slate-400">
                  {suggestion.kind === "reservation-candidate" ? "예약" : `${suggestion.estimatedMinutes}분`}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-soft">
      <div>
        <h3 className="text-base font-black text-slate-900">
          시간작업 배치 추천
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          정기 일정과 단기 일정을 모두 제외한 뒤, 시간작업과 예약 후보를 넣을
          수 있는 빈 시간을 추천합니다.
        </p>
        {feedbackMessage && (
          <p className="mt-3 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 ring-1 ring-blue-100">
            {feedbackMessage}
          </p>
        )}
      </div>

      {timeTasks.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
          아직 추천할 일이 없습니다. 예를 들어 “기하 문제 풀기”나 “머리
          잘라야 하는데 언제 예약하지”처럼 저장하면 추천이 표시됩니다.
        </p>
      ) : suggestions.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
          추천할 일은 있지만, 현재 캘린더 기준으로 들어갈 수 있는 빈 시간을
          찾지 못했습니다.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {visibleSuggestions.map((suggestion) => (
            <article
              key={getSuggestionKey(suggestion)}
              className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-black text-slate-900">
                    {suggestion.title}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {suggestion.kind === "reservation-candidate"
                      ? `예약 후보 · 예상 ${suggestion.estimatedMinutes}분`
                      : `예상 시간 ${suggestion.estimatedMinutes}분`}
                  </p>
                  {suggestion.sessionIndex && suggestion.sessionCount && (
                    <p className="mt-1 text-xs font-black text-indigo-600">
                      목표 {suggestion.sessionIndex}/{suggestion.sessionCount}
                      {suggestion.allocatedAmount && suggestion.workloadUnit
                        ? ` · 약 ${suggestion.allocatedAmount}${suggestion.workloadUnit}`
                        : ""}
                    </p>
                  )}
                </div>

                <div className="rounded-2xl bg-white px-3 py-2 text-sm font-black text-slate-800">
                  {suggestion.date} {suggestion.dayOfWeek}요일{" "}
                  {suggestion.startTime} ~ {suggestion.endTime}
                </div>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                {suggestion.reason}
              </p>

              {suggestion.appliedRules.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {suggestion.appliedRules.map((rule) => (
                    <span
                      key={`${suggestion.itemId}-${rule}`}
                      className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-500 ring-1 ring-slate-100"
                    >
                      {rule}
                    </span>
                  ))}
                </div>
              )}

              {editingSuggestionId === getSuggestionKey(suggestion) && (
                <div className="mt-4 grid gap-2 rounded-2xl bg-white p-3 ring-1 ring-slate-100 sm:grid-cols-2">
                  <input
                    value={draftSuggestion.title}
                    onChange={(event) =>
                      setDraftSuggestion((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-400"
                    placeholder="제목"
                  />
                  <input
                    type="date"
                    value={draftSuggestion.date}
                    onChange={(event) =>
                      setDraftSuggestion((current) => ({
                        ...current,
                        date: event.target.value,
                      }))
                    }
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-400"
                  />
                  <input
                    type="time"
                    value={draftSuggestion.startTime}
                    onChange={(event) =>
                      setDraftSuggestion((current) => ({
                        ...current,
                        startTime: event.target.value,
                      }))
                    }
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-400"
                  />
                  <input
                    type="time"
                    value={draftSuggestion.endTime}
                    onChange={(event) =>
                      setDraftSuggestion((current) => ({
                        ...current,
                        endTime: event.target.value,
                      }))
                    }
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-400"
                  />
                  <input
                    value={draftSuggestion.placeName}
                    onChange={(event) =>
                      setDraftSuggestion((current) => ({
                        ...current,
                        placeName: event.target.value,
                      }))
                    }
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-400 sm:col-span-2"
                    placeholder="장소"
                  />
                </div>
              )}

              <FeedbackButtons suggestion={suggestion} />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => confirmSuggestion(suggestion)}
                  className="rounded-full bg-blue-600 px-4 py-2 text-xs font-black text-white"
                >
                  이대로 확정
                </button>
                <button
                  type="button"
                  onClick={() => startEditingSuggestion(suggestion)}
                  className="rounded-full bg-white px-4 py-2 text-xs font-black text-slate-600 ring-1 ring-slate-100"
                >
                  수정 후 확정
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
