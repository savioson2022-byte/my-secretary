import { SingleSchedule } from "@/types/calendar";

const SINGLE_SCHEDULE_STORAGE_KEY = "my-assistant-single-schedules";
const SINGLE_SCHEDULE_UPDATED_EVENT = "single-schedules-updated";

function isBrowser() {
  return typeof window !== "undefined";
}

function notifySingleSchedulesUpdated() {
  if (!isBrowser()) {
    return;
  }

  window.dispatchEvent(new Event(SINGLE_SCHEDULE_UPDATED_EVENT));
}

export function getSingleScheduleUpdatedEventName() {
  return SINGLE_SCHEDULE_UPDATED_EVENT;
}

export function getSingleSchedules(): SingleSchedule[] {
  if (!isBrowser()) {
    return [];
  }

  const rawData = localStorage.getItem(SINGLE_SCHEDULE_STORAGE_KEY);

  if (!rawData) {
    return [];
  }

  try {
    const parsedData = JSON.parse(rawData);

    if (!Array.isArray(parsedData)) {
      return [];
    }

    return parsedData;
  } catch {
    return [];
  }
}

export function saveSingleSchedule(schedule: SingleSchedule) {
  if (!isBrowser()) {
    return;
  }

  const schedules = getSingleSchedules();

  const alreadyExists = schedules.some((savedSchedule) => {
    return (
      savedSchedule.sourceItemId &&
      savedSchedule.sourceItemId === schedule.sourceItemId
    );
  });

  if (alreadyExists) {
    return;
  }

  const nextSchedules = [schedule, ...schedules];

  localStorage.setItem(
    SINGLE_SCHEDULE_STORAGE_KEY,
    JSON.stringify(nextSchedules)
  );

  notifySingleSchedulesUpdated();
}

export function updateSingleSchedule(updatedSchedule: SingleSchedule) {
  if (!isBrowser()) {
    return;
  }

  const schedules = getSingleSchedules();

  const nextSchedules = schedules.map((schedule) => {
    if (schedule.id === updatedSchedule.id) {
      return updatedSchedule;
    }

    return schedule;
  });

  localStorage.setItem(
    SINGLE_SCHEDULE_STORAGE_KEY,
    JSON.stringify(nextSchedules)
  );

  notifySingleSchedulesUpdated();
}

export function deleteSingleSchedule(id: string) {
  if (!isBrowser()) {
    return;
  }

  const schedules = getSingleSchedules();

  const nextSchedules = schedules.filter((schedule) => schedule.id !== id);

  localStorage.setItem(
    SINGLE_SCHEDULE_STORAGE_KEY,
    JSON.stringify(nextSchedules)
  );

  notifySingleSchedulesUpdated();
}

export function getSingleSchedulesByDate(date: string): SingleSchedule[] {
  return getSingleSchedules().filter((schedule) => schedule.date === date);
}