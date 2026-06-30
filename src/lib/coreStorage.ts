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

const KEYS = {
  places: "my-assistant-places",
  routines: "my-assistant-routines",
  shortTermSchedules: "my-assistant-short-term-schedules",
  travelRules: "my-assistant-travel-rules",
  tasks: "my-assistant-tasks",
};

export function getPlaces() {
  return readLocalStorageArray<Place>(KEYS.places);
}

export function savePlace(place: Place) {
  writeLocalStorageArray(KEYS.places, [place, ...getPlaces()]);
}

export function getRoutineSchedules() {
  return readLocalStorageArray<RoutineSchedule>(KEYS.routines);
}

export function saveRoutineSchedule(routine: RoutineSchedule) {
  writeLocalStorageArray(KEYS.routines, [routine, ...getRoutineSchedules()]);
}

export function getShortTermSchedules() {
  return readLocalStorageArray<ShortTermSchedule>(KEYS.shortTermSchedules);
}

export function saveShortTermSchedule(schedule: ShortTermSchedule) {
  writeLocalStorageArray(KEYS.shortTermSchedules, [
    schedule,
    ...getShortTermSchedules(),
  ]);
}

export function getTravelTimeRules() {
  return readLocalStorageArray<TravelTimeRule>(KEYS.travelRules);
}

export function saveTravelTimeRule(rule: TravelTimeRule) {
  writeLocalStorageArray(KEYS.travelRules, [rule, ...getTravelTimeRules()]);
}

export function getTasks() {
  return readLocalStorageArray<AssistantTask>(KEYS.tasks);
}

export function saveTask(task: AssistantTask) {
  writeLocalStorageArray(KEYS.tasks, [task, ...getTasks()]);
}

export function updateTask(updatedTask: AssistantTask) {
  const nextTasks = getTasks().map((task) =>
    task.id === updatedTask.id ? updatedTask : task
  );

  writeLocalStorageArray(KEYS.tasks, nextTasks);
}

export function deleteTask(id: string) {
  const nextTasks = getTasks().filter((task) => task.id !== id);
  writeLocalStorageArray(KEYS.tasks, nextTasks);
}
