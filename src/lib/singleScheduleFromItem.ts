import { AssistantItem } from "@/types/assistant";
import { SingleSchedule } from "@/types/calendar";

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isValidTimeText(value: string | null | undefined) {
  if (!value) return false;

  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function timeToMinutes(time: string) {
  const [hourText, minuteText] = time.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return 0;
  }

  return hour * 60 + minute;
}

function minutesToTime(totalMinutes: number) {
  const safeMinutes = Math.max(0, Math.min(24 * 60, totalMinutes));
  const hour = Math.floor(safeMinutes / 60);
  const minute = safeMinutes % 60;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function detectStartTime(text: string): string | null {
  const colonTimeMatch = text.match(/(\d{1,2}):(\d{2})/);

  if (colonTimeMatch) {
    const hour = Number(colonTimeMatch[1]);
    const minute = Number(colonTimeMatch[2]);

    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(
        2,
        "0"
      )}`;
    }
  }

  const koreanTimeMatch = text.match(
    /(오전|오후|아침|점심|낮|저녁|밤|새벽)?\s*(\d{1,2})시\s*(\d{1,2}분)?/
  );

  if (!koreanTimeMatch) {
    return null;
  }

  const period = koreanTimeMatch[1] ?? "";
  let hour = Number(koreanTimeMatch[2]);
  const minuteText = koreanTimeMatch[3]?.replace("분", "") ?? "0";
  const minute = Number(minuteText);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }

  if (period === "오후" || period === "저녁" || period === "밤") {
    if (hour < 12) {
      hour += 12;
    }
  }

  if (period === "점심" || period === "낮") {
    if (hour < 12) {
      hour += 12;
    }
  }

  if (!period && hour >= 1 && hour <= 7) {
    hour += 12;
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function createSingleScheduleFromItem(
  item: AssistantItem
): SingleSchedule | null {
  if (item.processType !== "단기일정") {
    return null;
  }

  if (!item.dueDate) {
    return null;
  }

  const startTime = isValidTimeText(item.scheduleStartTime)
    ? item.scheduleStartTime!
    : detectStartTime(item.originalText);

  if (!startTime) {
    return null;
  }

  const endTime = isValidTimeText(item.scheduleEndTime)
    ? item.scheduleEndTime!
    : minutesToTime(timeToMinutes(startTime) + (item.estimatedMinutes ?? 60));

  const now = new Date().toISOString();

  return {
    id: createId(),
    title: item.title,
    date: item.dueDate,
    startTime,
    endTime,
    placeName:
      item.placePreference === "specific" ? item.placeName?.trim() ?? "" : "",
    placeAddress:
      item.placePreference === "specific"
        ? item.placeAddress?.trim() || undefined
        : undefined,
    placePostalCode:
      item.placePreference === "specific"
        ? item.placePostalCode?.trim() || undefined
        : undefined,
    memo: item.originalText,
    color: item.color,
    sourceItemId: item.id,
    createdAt: now,
    updatedAt: now,
  };
}
