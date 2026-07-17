import {
  addDays,
  calculateFreeTimeBlocksForDate,
  getDayOfWeekFromDateText,
  getTodayDateOnly,
  minutesToTime,
  timeToMinutes,
  toDateOnlyString,
} from "@/lib/availability";
import { AssistantItem } from "@/types/assistant";
import { SavedPlace, SingleSchedule } from "@/types/calendar";
import { RoutineSchedule } from "@/types/routine";
import type { SuggestionFeedback } from "@/types/suggestionFeedback";
import { UserProfile } from "@/types/userProfile";
import { getScheduleBlocksForDate } from "@/lib/travelTime";
import type { PersonalAiMemory } from "@/types/personalAi";

export type TimeTaskSuggestion = {
  itemId: string;
  title: string;
  kind: "time-task" | "reservation-candidate";
  date: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  estimatedMinutes: number;
  placeName: string | null;
  score: number;
  reason: string;
  appliedRules: string[];
};

type TaskContext = {
  isWorkout: boolean;
  isReservation: boolean;
  isBeautyReservation: boolean;
  targetPlace: SavedPlace | null;
};

type Candidate = TimeTaskSuggestion & {
  startMinutes: number;
};

const DEFAULT_TRAVEL_BUFFER_MINUTES = 25;
const SHOWER_BUFFER_MINUTES = 30;

function getSchedulableMinutes(item: AssistantItem) {
  if (item.processType === "시간작업" && item.estimatedMinutes) {
    return item.estimatedMinutes;
  }

  if (
    item.actionType === "예약" &&
    item.status === "미완료" &&
    !item.scheduleStartTime &&
    !item.scheduleEndTime
  ) {
    return item.estimatedMinutes ?? 60;
  }

  return null;
}

function getEffectiveSchedulableMinutes({
  item,
  context,
}: {
  item: AssistantItem;
  context: TaskContext;
}) {
  const minutes = getSchedulableMinutes(item);

  if (!minutes) {
    return null;
  }

  if (!item.estimatedMinutes && context.targetPlace?.typicalStayMinutes) {
    return context.targetPlace.typicalStayMinutes;
  }

  return minutes;
}

function getSuggestionKind(item: AssistantItem): TimeTaskSuggestion["kind"] {
  return item.actionType === "예약" ? "reservation-candidate" : "time-task";
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}

function inferPlaceTypeFromText(text: string): SavedPlace["placeType"] {
  if (includesAny(text, ["헬스", "gym", "피트니스", "운동"])) return "gym";
  if (includesAny(text, ["미용", "헤어", "커트", "머리"])) return "salon";
  if (includesAny(text, ["학교", "학원"])) return "school";
  if (includesAny(text, ["집", "자택"])) return "home";
  if (includesAny(text, ["회사", "사무실"])) return "work";
  if (includesAny(text, ["가게", "매장", "마트", "샵"])) return "shop";

  return "other";
}

function getPlaceType(place: SavedPlace) {
  return (
    place.placeType ??
    inferPlaceTypeFromText(`${place.name} ${place.address} ${place.memo}`)
  );
}

function inferTaskContext({
  item,
  savedPlaces,
}: {
  item: AssistantItem;
  savedPlaces: SavedPlace[];
}): TaskContext {
  const text = normalizeSearchText(`${item.title} ${item.originalText}`);
  const isWorkout =
    item.actionType === "운동" ||
    includesAny(text, ["운동", "헬스", "pt", "피티", "러닝", "수영"]);
  const isBeautyReservation =
    item.actionType === "예약" &&
    includesAny(text, ["머리", "커트", "미용", "헤어", "염색", "펌"]);
  const isReservation = item.actionType === "예약";
  const preferredPlaceType = isWorkout
    ? "gym"
    : isBeautyReservation
      ? "salon"
      : null;
  const targetPlace =
    savedPlaces.find((place) => {
      if (preferredPlaceType && getPlaceType(place) === preferredPlaceType) {
        return true;
      }

      const placeText = normalizeSearchText(`${place.name} ${place.memo}`);
      return (
        place.name.trim().length >= 2 &&
        (text.includes(normalizeSearchText(place.name)) ||
          placeText
            .split(/\s+/)
            .filter((token) => token.length >= 2)
            .some((token) => text.includes(token)))
      );
    }) ?? null;

  return {
    isWorkout,
    isReservation,
    isBeautyReservation,
    targetPlace,
  };
}

function getAllowedWindow({
  context,
  userProfile,
}: {
  context: TaskContext;
  userProfile?: UserProfile | null;
}) {
  if (
    context.targetPlace?.preferredVisitStartTime &&
    context.targetPlace.preferredVisitEndTime
  ) {
    return {
      startTime: context.targetPlace.preferredVisitStartTime,
      endTime: context.targetPlace.preferredVisitEndTime,
      label: `${context.targetPlace.name} 선호 방문 시간대`,
    };
  }

  if (
    context.targetPlace?.businessHoursStart &&
    context.targetPlace.businessHoursEnd
  ) {
    return {
      startTime: context.targetPlace.businessHoursStart,
      endTime: context.targetPlace.businessHoursEnd,
      label: `${context.targetPlace.name} 기본 영업 시간대`,
    };
  }

  if (context.isWorkout) {
    return {
      startTime: userProfile?.workoutPreferredStartTime ?? "17:00",
      endTime: userProfile?.workoutPreferredEndTime ?? "21:30",
      label: "운동 선호 시간대",
    };
  }

  if (context.isReservation) {
    return {
      startTime: userProfile?.reservationPreferredStartTime ?? "10:00",
      endTime: userProfile?.reservationPreferredEndTime ?? "20:00",
      label: context.isBeautyReservation
        ? "미용실 일반 영업 시간대"
        : "예약 가능성이 높은 낮 시간대",
    };
  }

  if (userProfile?.energyPattern === "morning") {
    return {
      startTime: "08:00",
      endTime: "18:00",
      label: "오전형 에너지 패턴",
    };
  }

  if (userProfile?.energyPattern === "night") {
    return {
      startTime: "11:00",
      endTime: "23:00",
      label: "저녁형 에너지 패턴",
    };
  }

  return {
    startTime: "08:00",
    endTime: "22:00",
    label: "기본 생활 시간대",
  };
}

function getTravelBuffers({
  date,
  candidateStartTime,
  candidateEndTime,
  targetPlace,
  routines,
  singleSchedules,
}: {
  date: string;
  candidateStartTime: string;
  candidateEndTime: string;
  targetPlace: SavedPlace | null;
  routines: RoutineSchedule[];
  singleSchedules: SingleSchedule[];
}) {
  if (!targetPlace) {
    return {
      beforeMinutes: 0,
      afterMinutes: 0,
      labels: [] as string[],
    };
  }

  const blocks = getScheduleBlocksForDate({
    date,
    routines,
    singleSchedules,
  });
  const startMinutes = timeToMinutes(candidateStartTime);
  const endMinutes = timeToMinutes(candidateEndTime);
  const previousBlock = [...blocks]
    .reverse()
    .find((block) => timeToMinutes(block.endTime) <= startMinutes);
  const nextBlock = blocks.find((block) => timeToMinutes(block.startTime) >= endMinutes);
  const targetPlaceName = normalizeSearchText(targetPlace.name);
  const beforeMinutes =
    previousBlock &&
    normalizeSearchText(previousBlock.placeName) !== targetPlaceName
      ? DEFAULT_TRAVEL_BUFFER_MINUTES
      : 0;
  const afterMinutes =
    nextBlock && normalizeSearchText(nextBlock.placeName) !== targetPlaceName
      ? DEFAULT_TRAVEL_BUFFER_MINUTES
      : 0;

  return {
    beforeMinutes,
    afterMinutes,
    labels: [
      beforeMinutes > 0
        ? `이전 일정 위치에서 ${targetPlace.name}까지 이동 여유 ${beforeMinutes}분`
        : null,
      afterMinutes > 0
        ? `${targetPlace.name}에서 다음 일정 위치까지 이동 여유 ${afterMinutes}분`
        : null,
    ].filter((label): label is string => Boolean(label)),
  };
}

function getEnergyScore({
  startMinutes,
  context,
  userProfile,
}: {
  startMinutes: number;
  context: TaskContext;
  userProfile?: UserProfile | null;
}) {
  if (context.isWorkout) {
    const preferredIdealStart = context.targetPlace?.preferredVisitStartTime
      ? timeToMinutes(context.targetPlace.preferredVisitStartTime)
      : null;
    if (preferredIdealStart !== null) {
      const distance = Math.abs(startMinutes - preferredIdealStart);
      return Math.max(0, 45 - Math.floor(distance / 30) * 5);
    }

    const idealStart = timeToMinutes(
      userProfile?.workoutPreferredStartTime ?? "17:00"
    );
    const distance = Math.abs(startMinutes - idealStart);
    return Math.max(0, 40 - Math.floor(distance / 30) * 5);
  }

  if (context.isReservation) {
    const idealStart = context.targetPlace?.preferredVisitStartTime
      ? timeToMinutes(context.targetPlace.preferredVisitStartTime)
      : context.isBeautyReservation
        ? timeToMinutes("14:00")
        : timeToMinutes("11:00");
    const distance = Math.abs(startMinutes - idealStart);
    return Math.max(0, 30 - Math.floor(distance / 60) * 4);
  }

  if (userProfile?.energyPattern === "morning") {
    return startMinutes < timeToMinutes("12:00") ? 25 : 10;
  }

  if (userProfile?.energyPattern === "night") {
    return startMinutes >= timeToMinutes("18:00") ? 25 : 10;
  }

  return startMinutes >= timeToMinutes("10:00") &&
    startMinutes <= timeToMinutes("18:00")
    ? 20
    : 8;
}

function getFeedbackAdjustment({
  item,
  date,
  startTime,
  endTime,
  placeName,
  suggestionFeedbacks,
}: {
  item: AssistantItem;
  date: string;
  startTime: string;
  endTime: string;
  placeName: string | null;
  suggestionFeedbacks: SuggestionFeedback[];
}) {
  const relevantFeedbacks = suggestionFeedbacks
    .filter((feedback) => feedback.itemId === item.id)
    .sort((a, b) => {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    })
    .slice(0, 8);

  let adjustment = 0;
  const labels: string[] = [];

  for (const feedback of relevantFeedbacks) {
    const samePlace = (feedback.placeName ?? "") === (placeName ?? "");
    const sameDate = feedback.suggestionDate === date;
    const sameTime =
      feedback.suggestionStartTime === startTime &&
      feedback.suggestionEndTime === endTime;

    if (feedback.feedbackType === "good") {
      adjustment += samePlace ? 16 : 8;
      labels.push("이전 긍정 피드백 반영");
      continue;
    }

    if (feedback.feedbackType === "bad") {
      adjustment -= sameDate || sameTime ? 24 : 12;
      labels.push("이전 부정 피드백 반영");
      continue;
    }

    if (feedback.feedbackType === "wrong_place" && samePlace) {
      adjustment -= 36;
      labels.push("장소가 맞지 않았던 피드백 반영");
    }
  }

  return {
    adjustment,
    labels: Array.from(new Set(labels)),
  };
}

function isValidDateText(dateText: string | null) {
  if (!dateText) {
    return false;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(dateText);
}

function getSearchDates(item: AssistantItem) {
  if (isValidDateText(item.dueDate)) {
    return [item.dueDate as string];
  }

  const today = getTodayDateOnly();

  return Array.from({ length: 14 }, (_, index) => {
    return toDateOnlyString(addDays(today, index));
  });
}

export function suggestTimeTaskSchedule({
  item,
  routines,
  singleSchedules,
  savedPlaces = [],
  userProfile = null,
  suggestionFeedbacks = [],
  personalAiMemories = [],
}: {
  item: AssistantItem;
  routines: RoutineSchedule[];
  singleSchedules: SingleSchedule[];
  savedPlaces?: SavedPlace[];
  userProfile?: UserProfile | null;
  suggestionFeedbacks?: SuggestionFeedback[];
  personalAiMemories?: PersonalAiMemory[];
}): TimeTaskSuggestion | null {
  if (item.status !== "미완료") {
    return null;
  }

  const searchDates = getSearchDates(item);
  const context = inferTaskContext({
    item,
    savedPlaces,
  });
  const estimatedMinutes = getEffectiveSchedulableMinutes({
    item,
    context,
  });

  if (!estimatedMinutes) {
    return null;
  }

  const allowedWindow = getAllowedWindow({
    context,
    userProfile,
  });
  const allowedStartMinutes = timeToMinutes(allowedWindow.startTime);
  const allowedEndMinutes = timeToMinutes(allowedWindow.endTime);
  const extraTaskBuffer =
    (context.targetPlace?.needsShowerAfterVisit ??
      (context.isWorkout && (userProfile?.needsShowerAfterWorkout ?? true)))
      ? SHOWER_BUFFER_MINUTES
      : 0;
  const candidates: Candidate[] = [];

  for (const date of searchDates) {
    const freeBlocks = calculateFreeTimeBlocksForDate({
      date,
      routines,
      singleSchedules,
    });

    for (const block of freeBlocks) {
      const blockStartMinutes = timeToMinutes(block.startTime);
      const blockEndMinutes = timeToMinutes(block.endTime);
      const startMinutes = Math.max(blockStartMinutes, allowedStartMinutes);
      const taskEndMinutes = startMinutes + estimatedMinutes;

      if (taskEndMinutes > Math.min(blockEndMinutes, allowedEndMinutes)) {
        continue;
      }

      const candidateStartTime = minutesToTime(startMinutes);
      const candidateEndTime = minutesToTime(taskEndMinutes);
      const travelBuffers = getTravelBuffers({
        date,
        candidateStartTime,
        candidateEndTime,
        targetPlace: context.targetPlace,
        routines,
        singleSchedules,
      });
      const requiredMinutes =
        estimatedMinutes +
        extraTaskBuffer +
        travelBuffers.beforeMinutes +
        travelBuffers.afterMinutes;
      const adjustedStartMinutes = startMinutes + travelBuffers.beforeMinutes;
      const adjustedEndMinutes = adjustedStartMinutes + estimatedMinutes;

      if (
        adjustedStartMinutes < blockStartMinutes ||
        adjustedEndMinutes + extraTaskBuffer + travelBuffers.afterMinutes >
          blockEndMinutes ||
        adjustedEndMinutes > allowedEndMinutes
      ) {
        continue;
      }

      const dayOfWeek = getDayOfWeekFromDateText(date);
      const kind = getSuggestionKind(item);
      const feedbackAdjustment = getFeedbackAdjustment({
        item,
        date,
        startTime: minutesToTime(adjustedStartMinutes),
        endTime: minutesToTime(adjustedEndMinutes),
        placeName: context.targetPlace?.name ?? null,
        suggestionFeedbacks,
      });
      const score =
        50 +
        getEnergyScore({
          startMinutes: adjustedStartMinutes,
          context,
          userProfile,
        }) +
        (context.targetPlace ? 15 : 0) +
        (block.minutes >= requiredMinutes + 30 ? 10 : 0) +
        feedbackAdjustment.adjustment;
      const appliedRules = [
        allowedWindow.label,
        personalAiMemories.some((memory) => memory.domain === "schedule")
          ? "계정 공유 AI 메모리 반영 준비"
          : null,
        context.targetPlace ? `선호/저장 장소: ${context.targetPlace.name}` : null,
        extraTaskBuffer > 0 ? `방문 후 샤워/정리 여유 ${extraTaskBuffer}분` : null,
        ...travelBuffers.labels,
        ...feedbackAdjustment.labels,
      ].filter((rule): rule is string => Boolean(rule));

      candidates.push({
        itemId: item.id,
        title: item.title,
        kind,
        date,
        dayOfWeek,
        startTime: minutesToTime(adjustedStartMinutes),
        endTime: minutesToTime(adjustedEndMinutes),
        estimatedMinutes,
        placeName: context.targetPlace?.name ?? null,
        score,
        appliedRules,
        startMinutes: adjustedStartMinutes,
        reason:
          kind === "reservation-candidate"
            ? `${allowedWindow.label}와 저장된 동선을 고려해 ${date} ${dayOfWeek}요일 ${minutesToTime(adjustedStartMinutes)}~${minutesToTime(adjustedEndMinutes)}을 예약 후보로 추천합니다.`
            : `${allowedWindow.label}, 에너지 수준, 앞뒤 일정 위치를 고려해 ${date} ${dayOfWeek}요일 ${minutesToTime(adjustedStartMinutes)}~${minutesToTime(adjustedEndMinutes)}에 배치할 수 있습니다.`,
      });
    }
  }

  return (
    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startMinutes - b.startMinutes;
    })[0] ?? null
  );
}

export function suggestTimeTaskSchedules({
  items,
  routines,
  singleSchedules,
  savedPlaces = [],
  userProfile = null,
  suggestionFeedbacks = [],
  personalAiMemories = [],
}: {
  items: AssistantItem[];
  routines: RoutineSchedule[];
  singleSchedules: SingleSchedule[];
  savedPlaces?: SavedPlace[];
  userProfile?: UserProfile | null;
  suggestionFeedbacks?: SuggestionFeedback[];
  personalAiMemories?: PersonalAiMemory[];
}): TimeTaskSuggestion[] {
  return items
    .map((item) =>
      suggestTimeTaskSchedule({
        item,
        routines,
        singleSchedules,
        savedPlaces,
        userProfile,
        suggestionFeedbacks,
        personalAiMemories,
      })
    )
    .filter((suggestion): suggestion is TimeTaskSuggestion => {
      return suggestion !== null;
    });
}
