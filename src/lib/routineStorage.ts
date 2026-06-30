import { RoutineSchedule } from "@/types/routine";

const ROUTINE_STORAGE_KEY = "my-assistant-routine-schedules";

export function getRoutineSchedules(): RoutineSchedule[] {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(ROUTINE_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRoutineSchedule(routine: RoutineSchedule) {
  const routines = getRoutineSchedules();
  const nextRoutines = [routine, ...routines];

  window.localStorage.setItem(
    ROUTINE_STORAGE_KEY,
    JSON.stringify(nextRoutines)
  );
}

export function deleteRoutineSchedule(id: string) {
  const routines = getRoutineSchedules();
  const nextRoutines = routines.filter((routine) => routine.id !== id);

  window.localStorage.setItem(
    ROUTINE_STORAGE_KEY,
    JSON.stringify(nextRoutines)
  );
}
