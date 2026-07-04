import { RoutineSchedule } from "@/types/routine";
import { createLocalStorageRepository } from "@/lib/localStorageRepository";
import { STORAGE_KEYS } from "@/lib/storageKeys";

const routineScheduleRepository =
  createLocalStorageRepository<RoutineSchedule>(STORAGE_KEYS.routineSchedules);

export function getRoutineSchedules(): RoutineSchedule[] {
  return routineScheduleRepository.list();
}

export function saveRoutineSchedule(routine: RoutineSchedule) {
  routineScheduleRepository.create(routine);
}

export function updateRoutineSchedule(routine: RoutineSchedule) {
  routineScheduleRepository.update(routine);
}

export function deleteRoutineSchedule(id: string) {
  routineScheduleRepository.delete(id);
}
