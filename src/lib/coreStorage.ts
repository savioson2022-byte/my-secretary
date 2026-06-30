import {
  AssistantTask,
  Place,
  RoutineSchedule,
  ShortTermSchedule,
  TravelTimeRule,
} from "@/types/assistant-core";

const KEYS = {
  places: "my-assistant-places",
  routines: "my-assistant-routines",
  shortTermSchedules: "my-assistant-short-term-schedules",
  travelRules: "my-assistant-travel-rules",
  tasks: "my-assistant-tasks",
};

function readArray<T>(key: string): T[] {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(key);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeArray<T>(key: string, value: T[]) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getPlaces() {
  return readArray<Place>(KEYS.places);
}

export function savePlace(place: Place) {
  writeArray(KEYS.places, [place, ...getPlaces()]);
}

export function getRoutineSchedules() {
  return readArray<RoutineSchedule>(KEYS.routines);
}

export function saveRoutineSchedule(routine: RoutineSchedule) {
  writeArray(KEYS.routines, [routine, ...getRoutineSchedules()]);
}

export function getShortTermSchedules() {
  return readArray<ShortTermSchedule>(KEYS.shortTermSchedules);
}

export function saveShortTermSchedule(schedule: ShortTermSchedule) {
  writeArray(KEYS.shortTermSchedules, [
    schedule,
    ...getShortTermSchedules(),
  ]);
}

export function getTravelTimeRules() {
  return readArray<TravelTimeRule>(KEYS.travelRules);
}

export function saveTravelTimeRule(rule: TravelTimeRule) {
  writeArray(KEYS.travelRules, [rule, ...getTravelTimeRules()]);
}

export function getTasks() {
  return readArray<AssistantTask>(KEYS.tasks);
}

export function saveTask(task: AssistantTask) {
  writeArray(KEYS.tasks, [task, ...getTasks()]);
}

export function updateTask(updatedTask: AssistantTask) {
  const nextTasks = getTasks().map((task) =>
    task.id === updatedTask.id ? updatedTask : task
  );

  writeArray(KEYS.tasks, nextTasks);
}

export function deleteTask(id: string) {
  const nextTasks = getTasks().filter((task) => task.id !== id);
  writeArray(KEYS.tasks, nextTasks);
}