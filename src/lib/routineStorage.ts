import { RoutineSchedule } from "@/types/routine";
import { createLocalStorageRepository } from "@/lib/localStorageRepository";

const ROUTINE_STORAGE_KEY = "my-assistant-routine-schedules";
const routineScheduleRepository =
  createLocalStorageRepository<RoutineSchedule>(ROUTINE_STORAGE_KEY);

export function getRoutineSchedules(): RoutineSchedule[] {
  return routineScheduleRepository.list();
}

export function saveRoutineSchedule(routine: RoutineSchedule) {
  routineScheduleRepository.create(routine);
}

export function deleteRoutineSchedule(id: string) {
  routineScheduleRepository.delete(id);
}
