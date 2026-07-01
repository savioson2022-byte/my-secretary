import {
  AssistantTask,
  Place,
  RoutineSchedule,
  ShortTermSchedule,
  TravelTimeRule,
} from "@/types/assistant-core";
import {
  readLocalStorageArray,
  writeLocalStorageArray,
} from "@/lib/localStorageRepository";
import { LEGACY_STORAGE_KEYS } from "@/lib/storageKeys";

export function getPlaces() {
  return readLocalStorageArray<Place>(LEGACY_STORAGE_KEYS.places);
}

export function savePlace(place: Place) {
  writeLocalStorageArray(LEGACY_STORAGE_KEYS.places, [place, ...getPlaces()]);
}

export function getRoutineSchedules() {
  return readLocalStorageArray<RoutineSchedule>(LEGACY_STORAGE_KEYS.routines);
}

export function saveRoutineSchedule(routine: RoutineSchedule) {
  writeLocalStorageArray(LEGACY_STORAGE_KEYS.routines, [
    routine,
    ...getRoutineSchedules(),
  ]);
}

export function getShortTermSchedules() {
  return readLocalStorageArray<ShortTermSchedule>(
    LEGACY_STORAGE_KEYS.shortTermSchedules
  );
}

export function saveShortTermSchedule(schedule: ShortTermSchedule) {
  writeLocalStorageArray(LEGACY_STORAGE_KEYS.shortTermSchedules, [
    schedule,
    ...getShortTermSchedules(),
  ]);
}

export function getTravelTimeRules() {
  return readLocalStorageArray<TravelTimeRule>(LEGACY_STORAGE_KEYS.travelRules);
}

export function saveTravelTimeRule(rule: TravelTimeRule) {
  writeLocalStorageArray(LEGACY_STORAGE_KEYS.travelRules, [
    rule,
    ...getTravelTimeRules(),
  ]);
}

export function getTasks() {
  return readLocalStorageArray<AssistantTask>(LEGACY_STORAGE_KEYS.tasks);
}

export function saveTask(task: AssistantTask) {
  writeLocalStorageArray(LEGACY_STORAGE_KEYS.tasks, [task, ...getTasks()]);
}

export function updateTask(updatedTask: AssistantTask) {
  const nextTasks = getTasks().map((task) =>
    task.id === updatedTask.id ? updatedTask : task
  );

  writeLocalStorageArray(LEGACY_STORAGE_KEYS.tasks, nextTasks);
}

export function deleteTask(id: string) {
  const nextTasks = getTasks().filter((task) => task.id !== id);
  writeLocalStorageArray(LEGACY_STORAGE_KEYS.tasks, nextTasks);
}
