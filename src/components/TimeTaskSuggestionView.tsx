"use client";

import { suggestTimeTaskSchedules } from "@/lib/taskScheduleSuggestion";
import { AssistantItem } from "@/types/assistant";
import { SingleSchedule } from "@/types/calendar";
import { RoutineSchedule } from "@/types/routine";

type TimeTaskSuggestionViewProps = {
  items: AssistantItem[];
  routines: RoutineSchedule[];
  singleSchedules: SingleSchedule[];
};

export default function TimeTaskSuggestionView({
  items,
  routines,
  singleSchedules,
}: TimeTaskSuggestionViewProps) {
  const suggestions = suggestTimeTaskSchedules({
    items,
    routines,
    singleSchedules,
  });

  const timeTasks = items.filter((item) => {
    return item.status === "미완료" && item.processType === "시간작업";
  });

  return (
    <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-soft">
      <div>
        <h3 className="text-base font-black text-slate-900">
          시간작업 배치 추천
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          정기 일정과 단기 일정을 모두 제외한 뒤, 시간작업을 넣을 수 있는 빈
          시간을 추천합니다.
        </p>
      </div>

      {timeTasks.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
          아직 추천할 시간작업이 없습니다. 예를 들어 “기하 문제 풀기”처럼
          저장하면 추천이 표시됩니다.
        </p>
      ) : suggestions.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
          시간작업은 있지만, 현재 캘린더 기준으로 들어갈 수 있는 빈 시간을
          찾지 못했습니다.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {suggestions.map((suggestion) => (
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
                    예상 시간 {suggestion.estimatedMinutes}분
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
            </article>
          ))}
        </div>
      )}
    </section>
  );
}