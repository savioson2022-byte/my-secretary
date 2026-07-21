import { SingleSchedule } from "@/types/calendar";
import {
  createLocalStorageRepository,
  isBrowser,
} from "@/lib/localStorageRepository";
import { STORAGE_KEYS } from "@/lib/storageKeys";

const SINGLE_SCHEDULE_UPDATED_EVENT = "single-schedules-updated";
const singleScheduleRepository =
  createLocalStorageRepository<SingleSchedule>(STORAGE_KEYS.singleSchedules);

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
  return singleScheduleRepository.list();
}

export function saveSingleSchedule(schedule: SingleSchedule) {
  if (!isBrowser()) {
    return;
  }

  const schedules = getSingleSchedules();

  const alreadyExists = schedules.some((savedSchedule) => {
    return (
      savedSchedule.sourceItemId &&
      savedSchedule.sourceItemId === schedule.sourceItemId &&
      savedSchedule.date === schedule.date &&
      savedSchedule.startTime === schedule.startTime &&
      savedSchedule.endTime === schedule.endTime
    );
  });

  if (alreadyExists) {
    return;
  }

  singleScheduleRepository.create(schedule);

  notifySingleSchedulesUpdated();
}

export function updateSingleSchedule(updatedSchedule: SingleSchedule) {
  if (!isBrowser()) {
    return;
  }

  singleScheduleRepository.update(updatedSchedule);

  notifySingleSchedulesUpdated();
}

export function deleteSingleSchedule(id: string) {
  if (!isBrowser()) {
    return;
  }

  singleScheduleRepository.delete(id);

  notifySingleSchedulesUpdated();
}

export function getSingleSchedulesByDate(date: string): SingleSchedule[] {
  return getSingleSchedules().filter((schedule) => schedule.date === date);
}
