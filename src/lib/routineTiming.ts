import type { RoutineSchedule } from "../types/routine";

export function changeRoutineTiming(
  routines: RoutineSchedule[],
  original: RoutineSchedule,
  timing: Pick<RoutineSchedule, "dayOfWeek" | "startTime" | "endTime">,
  now = new Date().toISOString()
): RoutineSchedule {
  const current = routines.find(item => item.id === original.id);
  if (!current || JSON.stringify(current) !== JSON.stringify(original)) {
    throw new Error("일정이 다른 곳에서 변경됐습니다. 새로고침 후 다시 수정해 주세요.");
  }
  if (!["월", "화", "수", "목", "금", "토", "일"].includes(timing.dayOfWeek) ||
    ![timing.startTime, timing.endTime].every(time => /^([01]\d|2[0-3]):[0-5]\d$/.test(time)) ||
    timing.startTime >= timing.endTime) {
    throw new Error("요일과 시간을 확인해 주세요. 종료 시간은 시작 시간보다 늦어야 합니다.");
  }
  const duplicate = routines.some(item => item.id !== current.id && item.isActive &&
    item.title.trim().toLowerCase() === current.title.trim().toLowerCase() &&
    item.dayOfWeek === timing.dayOfWeek && item.startTime === timing.startTime && item.endTime === timing.endTime &&
    (item.endDate ?? "9999-12-31") >= (current.startDate ?? "0000-01-01") &&
    (current.endDate ?? "9999-12-31") >= (item.startDate ?? "0000-01-01"));
  if (duplicate) throw new Error("같은 요일·시간에 이 수업이 이미 있습니다. 기존 수업을 확인해 주세요.");
  return { ...current, dayOfWeek: timing.dayOfWeek, startTime: timing.startTime, endTime: timing.endTime, updatedAt: now };
}
