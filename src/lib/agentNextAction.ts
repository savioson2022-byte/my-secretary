import {
  getTodayDateOnly,
  timeToMinutes,
  toDateOnlyString,
} from "@/lib/availability";
import { getMissingRequirements } from "@/lib/captureRequirements";
import { suggestTimeTaskSchedules } from "@/lib/taskScheduleSuggestion";
import type { AssistantItem } from "@/types/assistant";
import type { SavedPlace, SingleSchedule } from "@/types/calendar";
import type { ExternalCalendarEvent } from "@/types/externalCalendar";
import type { PersonalAiMemory } from "@/types/personalAi";
import type { RoutineSchedule } from "@/types/routine";
import type { SuggestionFeedback } from "@/types/suggestionFeedback";
import type { UserProfile } from "@/types/userProfile";

/**
 * "지금 할 것 하나"를 정하는 판단 로직.
 *
 * 목록을 보여주고 사용자가 고르게 하는 대신, 비서가 하나를 골라 먼저 건넨다.
 * 저장소를 읽지 않는 순수 함수라 브라우저와 서버 루프에서 똑같이 돈다.
 */

export type AgentNextActionKind =
  /** 곧 시작하거나 출발해야 하는 일정 */
  | "upcoming_schedule"
  /** 오늘까지 끝내야 하는 일 */
  | "due_today"
  /** 저장은 됐지만 값이 덜 찬 기록 */
  | "needs_review"
  /** 빈 시간에 넣기 좋은 시간작업 */
  | "suggested_session"
  /** 지금 급한 것이 없음 */
  | "clear";

export type AgentNextAction = {
  /** 같은 판단이면 같은 id. 미루기와 거절을 기억하는 기준이 된다. */
  id: string;
  kind: AgentNextActionKind;
  title: string;
  body: string;
  /** 승인 버튼에 쓸 문구 */
  approveLabel: string;
  url: string;
  sourceItemId: string | null;
  /** suggested_session일 때만 채워진다. */
  suggestedDate: string | null;
  suggestedStartTime: string | null;
  suggestedEndTime: string | null;
};

export type AgentNextActionInput = {
  items: AssistantItem[];
  routines: RoutineSchedule[];
  singleSchedules: SingleSchedule[];
  savedPlaces?: SavedPlace[];
  userProfile?: UserProfile | null;
  suggestionFeedbacks?: SuggestionFeedback[];
  personalAiMemories?: PersonalAiMemory[];
  externalEvents?: ExternalCalendarEvent[];
  /** 이미 미루거나 거절한 판단의 id */
  dismissedActionIds?: string[];
  now?: Date;
};

const UPCOMING_WINDOW_MINUTES = 180;

function formatMinutesUntil(minutes: number) {
  if (minutes <= 0) return "지금";
  if (minutes < 60) return `${minutes}분 뒤`;

  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;

  return remain === 0 ? `${hours}시간 뒤` : `${hours}시간 ${remain}분 뒤`;
}

function isTodayOrPast(dateText: string | null | undefined, todayText: string) {
  if (!dateText) return false;

  return dateText.slice(0, 10) <= todayText;
}

const CLEAR_ACTION: AgentNextAction = {
  id: "clear",
  kind: "clear",
  title: "지금 급한 건 없어요",
  body: "떠오르는 게 있으면 그냥 던져두세요. 정리는 제가 할게요.",
  approveLabel: "확인",
  url: "/",
  sourceItemId: null,
  suggestedDate: null,
  suggestedStartTime: null,
  suggestedEndTime: null,
};

export function decideNextAction({
  items,
  routines,
  singleSchedules,
  savedPlaces = [],
  userProfile = null,
  suggestionFeedbacks = [],
  personalAiMemories = [],
  externalEvents = [],
  dismissedActionIds = [],
  now = new Date(),
}: AgentNextActionInput): AgentNextAction {
  const dismissed = new Set(dismissedActionIds);
  const todayText = toDateOnlyString(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const candidates: AgentNextAction[] = [];

  // 1순위. 곧 시작하는 일정. 시간이 정해진 것보다 급한 건 없다.
  const upcoming = [...singleSchedules]
    .filter((schedule) => schedule.date === todayText)
    .map((schedule) => ({
      schedule,
      startMinutes: timeToMinutes(schedule.startTime),
    }))
    .filter(({ startMinutes }) => {
      const minutesUntil = startMinutes - currentMinutes;
      return minutesUntil >= 0 && minutesUntil <= UPCOMING_WINDOW_MINUTES;
    })
    .sort((left, right) => left.startMinutes - right.startMinutes)[0];

  if (upcoming) {
    const minutesUntil = upcoming.startMinutes - currentMinutes;

    candidates.push({
      id: `upcoming:${upcoming.schedule.id}`,
      kind: "upcoming_schedule",
      title: `${upcoming.schedule.startTime} ${upcoming.schedule.title}`,
      body: upcoming.schedule.placeName
        ? `${formatMinutesUntil(minutesUntil)} · ${upcoming.schedule.placeName}`
        : formatMinutesUntil(minutesUntil),
      approveLabel: "확인했어요",
      url: "/calendar/weekly",
      sourceItemId: upcoming.schedule.sourceItemId ?? null,
      suggestedDate: upcoming.schedule.date,
      suggestedStartTime: upcoming.schedule.startTime,
      suggestedEndTime: upcoming.schedule.endTime,
    });
  }

  // 2순위. 오늘까지인데 아직 안 끝난 일.
  const dueToday = items
    .filter((item) => item.status === "미완료")
    .filter((item) => isTodayOrPast(item.dueDate, todayText))
    .sort((left, right) => {
      const priorityRank = { 높음: 0, 보통: 1, 낮음: 2 } as const;
      return priorityRank[left.priority] - priorityRank[right.priority];
    })[0];

  if (dueToday) {
    candidates.push({
      id: `due:${dueToday.id}:${todayText}`,
      kind: "due_today",
      title: dueToday.title,
      body:
        dueToday.dueDate && dueToday.dueDate.slice(0, 10) < todayText
          ? "마감일이 지났어요. 지금 처리하거나 날짜를 미뤄주세요."
          : "오늘까지예요.",
      approveLabel: "끝냈어요",
      url: "/records",
      sourceItemId: dueToday.id,
      suggestedDate: null,
      suggestedStartTime: null,
      suggestedEndTime: null,
    });
  }

  // 3순위. 저장은 됐는데 값이 덜 차서 캘린더에 못 올라간 기록.
  const incomplete = items
    .filter((item) => item.status === "미완료")
    .map((item) => ({ item, missing: getMissingRequirements(item) }))
    .filter(({ missing }) => missing.length > 0)[0];

  if (incomplete) {
    candidates.push({
      id: `review:${incomplete.item.id}`,
      kind: "needs_review",
      title: incomplete.item.title,
      body: `${incomplete.missing[0].message}. 채우면 캘린더에 올려둘게요.`,
      approveLabel: "채우기",
      url: "/",
      sourceItemId: incomplete.item.id,
      suggestedDate: null,
      suggestedStartTime: null,
      suggestedEndTime: null,
    });
  }

  // 4순위. 빈 시간에 넣기 좋은 시간작업 한 건.
  const suggestion = suggestTimeTaskSchedules({
    items,
    routines,
    singleSchedules,
    externalEvents,
    savedPlaces,
    userProfile,
    suggestionFeedbacks,
    personalAiMemories,
  })[0];

  if (suggestion) {
    candidates.push({
      id: `session:${suggestion.itemId}:${suggestion.date}:${suggestion.startTime}`,
      kind: "suggested_session",
      title: suggestion.title,
      body: `${suggestion.date} ${suggestion.startTime}–${suggestion.endTime}에 넣어둘까요? ${suggestion.reason}`,
      approveLabel: "그때 할게요",
      url: "/calendar/weekly",
      sourceItemId: suggestion.itemId,
      suggestedDate: suggestion.date,
      suggestedStartTime: suggestion.startTime,
      suggestedEndTime: suggestion.endTime,
    });
  }

  const chosen = candidates.find((candidate) => !dismissed.has(candidate.id));

  return chosen ?? CLEAR_ACTION;
}
