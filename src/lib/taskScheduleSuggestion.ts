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
import { SingleSchedule } from "@/types/calendar";
import { RoutineSchedule } from "@/types/routine";

export type TimeTaskSuggestion = {
  itemId: string;
  title: string;
  kind: "time-task" | "reservation-candidate";
  date: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  estimatedMinutes: number;
  reason: string;
};

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

function getSuggestionKind(item: AssistantItem): TimeTaskSuggestion["kind"] {
  return item.actionType === "예약" ? "reservation-candidate" : "time-task";
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
}: {
  item: AssistantItem;
  routines: RoutineSchedule[];
  singleSchedules: SingleSchedule[];
}): TimeTaskSuggestion | null {
  if (item.status !== "미완료") {
    return null;
  }

  const estimatedMinutes = getSchedulableMinutes(item);
  if (!estimatedMinutes) {
    return null;
  }

  const searchDates = getSearchDates(item);

  for (const date of searchDates) {
    const freeBlocks = calculateFreeTimeBlocksForDate({
      date,
      routines,
      singleSchedules,
    });

    const availableBlock = freeBlocks.find((block) => {
      return block.minutes >= estimatedMinutes;
    });

    if (!availableBlock) {
      continue;
    }

    const startMinutes = timeToMinutes(availableBlock.startTime);
    const endMinutes = startMinutes + estimatedMinutes;
    const dayOfWeek = getDayOfWeekFromDateText(date);
    const kind = getSuggestionKind(item);

    return {
      itemId: item.id,
      title: item.title,
      kind,
      date,
      dayOfWeek,
      startTime: availableBlock.startTime,
      endTime: minutesToTime(endMinutes),
      estimatedMinutes,
      reason:
        kind === "reservation-candidate"
          ? `${date} ${dayOfWeek}요일의 ${availableBlock.startTime}~${availableBlock.endTime} 빈 시간 안에서 예약 후보 시간을 잡을 수 있습니다. 실제 예약 API가 연결되면 이 시간대를 기준으로 예약 가능 시간을 확인할 수 있습니다.`
          : `${date} ${dayOfWeek}요일의 ${availableBlock.startTime}~${availableBlock.endTime} 빈 시간 안에 예상 시간 ${estimatedMinutes}분 작업을 넣을 수 있습니다. 정기 일정과 단기 일정을 모두 제외한 추천입니다.`,
    };
  }

  return null;
}

export function suggestTimeTaskSchedules({
  items,
  routines,
  singleSchedules,
}: {
  items: AssistantItem[];
  routines: RoutineSchedule[];
  singleSchedules: SingleSchedule[];
}): TimeTaskSuggestion[] {
  return items
    .map((item) =>
      suggestTimeTaskSchedule({
        item,
        routines,
        singleSchedules,
      })
    )
    .filter((suggestion): suggestion is TimeTaskSuggestion => {
      return suggestion !== null;
    });
}
