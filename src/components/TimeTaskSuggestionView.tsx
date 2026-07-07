"use client";

import { useEffect, useState } from "react";
import { suggestTimeTaskSchedules } from "@/lib/taskScheduleSuggestion";
import { getCloudDataSyncedEventName } from "@/lib/dataSyncEvents";
import { getLocalDataUpdatedEventName } from "@/lib/localStorageRepository";
import { getSavedPlaces } from "@/lib/placeStorage";
import { getUserProfile } from "@/lib/userProfileStorage";
import { AssistantItem } from "@/types/assistant";
import { SavedPlace, SingleSchedule } from "@/types/calendar";
import { RoutineSchedule } from "@/types/routine";
import { UserProfile } from "@/types/userProfile";

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

  useEffect(() => {
    function refreshRecommendationContext() {
      setSavedPlaces(getSavedPlaces());
      setUserProfile(getUserProfile());
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
  });
  const visibleSuggestions =
    typeof maxItems === "number" ? suggestions.slice(0, maxItems) : suggestions;

  const timeTasks = items.filter((item) => {
    return (
      item.status === "미완료" &&
      (item.processType === "시간작업" || item.actionType === "예약")
    );
  });

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
                key={suggestion.itemId}
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
                  {suggestion.placeName && (
                    <p className="mt-0.5 truncate text-xs font-black text-blue-500">
                      {suggestion.placeName} 기준
                    </p>
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
              key={suggestion.itemId}
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
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
