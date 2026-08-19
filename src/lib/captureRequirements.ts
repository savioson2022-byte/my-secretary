import type { AssistantItem, AssistantItemWithoutId } from "@/types/assistant";

/**
 * 기록이 캘린더에 올라가려면 채워져야 하는 값들.
 *
 * 예전에는 이 조건들이 저장을 막는 관문이었다. 지금은 저장을 막지 않는다.
 * 조건이 덜 찼으면 기록은 그대로 저장되고, "확인 필요"로만 표시된다.
 * 던지는 순간의 마찰이 앱의 생사를 가르기 때문이다.
 */

export type CaptureRequirement = {
  field: string;
  message: string;
};

type ReviewableItem = AssistantItemWithoutId | AssistantItem;

export function getMissingRequirements(
  item: ReviewableItem
): CaptureRequirement[] {
  const missing: CaptureRequirement[] = [];

  if (!item.title.trim()) {
    missing.push({ field: "title", message: "제목이 비어 있어요" });
  }

  const needsPlace =
    (item.processType === "단기일정" || item.processType === "시간작업") &&
    item.placePreference === "specific";

  if (needsPlace && (!item.placeId || !item.placeName?.trim())) {
    missing.push({ field: "place", message: "장소를 정해야 해요" });
  }

  if (item.processType === "단기일정") {
    if (!item.dueDate) {
      missing.push({ field: "dueDate", message: "날짜가 필요해요" });
    }
    if (!item.scheduleStartTime) {
      missing.push({ field: "scheduleStartTime", message: "시작 시간이 필요해요" });
    }
    if (!item.scheduleEndTime) {
      missing.push({ field: "scheduleEndTime", message: "종료 시간이 필요해요" });
    } else if (item.scheduleEndTime === item.scheduleStartTime) {
      missing.push({
        field: "scheduleEndTime",
        message: "시작과 종료 시간이 같아요",
      });
    }
  }

  if (item.processType === "시간작업") {
    if (!item.goalStartDate || !item.dueDate) {
      missing.push({ field: "goalRange", message: "시작일과 마감일이 필요해요" });
    } else if (item.goalStartDate > item.dueDate) {
      missing.push({
        field: "goalRange",
        message: "마감일이 시작일보다 빨라요",
      });
    }

    if (!item.goalTotalAmount || item.goalTotalAmount <= 0 || !item.goalUnit?.trim()) {
      missing.push({ field: "goalAmount", message: "전체 분량이 필요해요" });
    }

    if (!item.estimatedMinutes || item.estimatedMinutes <= 0) {
      missing.push({ field: "estimatedMinutes", message: "총 예상 시간이 필요해요" });
    }

    if (!item.goalSessionMinutes || item.goalSessionMinutes <= 0) {
      missing.push({
        field: "goalSessionMinutes",
        message: "한 번에 작업할 시간이 필요해요",
      });
    }
  }

  return missing;
}

export function isReadyToSchedule(item: ReviewableItem): boolean {
  return getMissingRequirements(item).length === 0;
}

/** 사용자가 아직 확인해야 하는, 저장은 이미 된 기록. */
export function needsReview(item: AssistantItem): boolean {
  if (item.status !== "미완료") return false;

  return getMissingRequirements(item).length > 0;
}

/** "날짜가 필요해요 · 시작 시간이 필요해요" 처럼 한 줄로 만든다. */
export function describeMissingRequirements(item: ReviewableItem): string {
  return getMissingRequirements(item)
    .map((requirement) => requirement.message)
    .join(" · ");
}
