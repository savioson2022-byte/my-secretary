import { classifyInput } from "@/lib/classifyInput";
import { isReadyToSchedule } from "@/lib/captureRequirements";
import { createSingleScheduleFromItem } from "@/lib/singleScheduleFromItem";
import { saveSingleSchedule } from "@/lib/singleScheduleStorage";
import { saveItem, updateItem } from "@/lib/storage";
import type { AssistantItem, AssistantItemWithoutId } from "@/types/assistant";

/**
 * 던진 생각을 즉시 저장하는 경로.
 *
 * 규칙 기반 분류(classifyInput)는 동기 함수라 네트워크를 기다리지 않는다.
 * 그래서 원문은 항상 곧바로 저장되고, AI 분류 결과는 나중에 덮어쓴다.
 * 사용자는 저장을 위해 어떤 폼도 채우지 않는다.
 */

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** 저장된 기록에 맞는 단기 일정이 만들어질 수 있으면 만든다. */
function syncScheduleForItem(item: AssistantItem) {
  if (!isReadyToSchedule(item)) return false;

  const schedule = createSingleScheduleFromItem(item);

  if (!schedule) return false;

  saveSingleSchedule(schedule);
  return true;
}

export function captureInstantly(text: string): AssistantItem {
  const now = new Date().toISOString();
  const item: AssistantItem = {
    ...classifyInput(text),
    id: createId(),
    createdAt: now,
    updatedAt: now,
  };

  saveItem(item);
  syncScheduleForItem(item);

  return item;
}

/**
 * 백그라운드 AI 분류가 끝난 뒤 이미 저장된 기록을 갱신한다.
 * 사용자가 그 사이에 직접 고쳤다면 덮어쓰지 않는다.
 */
export function applyAiClassification({
  itemId,
  classification,
  previous,
}: {
  itemId: string;
  classification: AssistantItemWithoutId;
  previous: AssistantItem;
}): AssistantItem | null {
  if (previous.updatedAt !== previous.createdAt) {
    // 사용자가 먼저 손을 댔다. AI 결과로 덮지 않는다.
    return null;
  }

  const nextItem: AssistantItem = {
    ...classification,
    id: itemId,
    createdAt: previous.createdAt,
    updatedAt: new Date().toISOString(),
  };

  updateItem(nextItem);
  syncScheduleForItem(nextItem);

  return nextItem;
}

/** 확인 화면에서 사용자가 고친 내용을 저장한다. */
export function saveReviewedItem(item: AssistantItem): AssistantItem {
  const nextItem: AssistantItem = {
    ...item,
    updatedAt: new Date().toISOString(),
  };

  updateItem(nextItem);
  syncScheduleForItem(nextItem);

  return nextItem;
}
