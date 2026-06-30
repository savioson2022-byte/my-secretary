import { SingleSchedule } from "@/types/calendar";
import { DayOfWeek, RoutineSchedule } from "@/types/routine";

export type FreeTimeBlock = {
  startTime: string;
  endTime: string;
  minutes: number;
};

type BusyTimeBlock = {
  startMinutes: number;
  endMinutes: number;
};

type CalculateFreeTimeBlocksParams = {
  dayOfWeek: DayOfWeek;
  routines: RoutineSchedule[];
  referenceDate?: Date;
};

type CalculateFreeTimeBlocksForDateParams = {
  date: string;
  routines: RoutineSchedule[];
  singleSchedules: SingleSchedule[];
};

const DAY_START_MINUTES = 0;
const DAY_END_MINUTES = 24 * 60;

const DAYS: DayOfWeek[] = ["일", "월", "화", "수", "목", "금", "토"];

export function timeToMinutes(time: string): number {
  const [hourText, minuteText] = time.split(":");

  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return 0;
  }

  return hour * 60 + minute;
}

export function minutesToTime(totalMinutes: number): string {
  const safeMinutes = Math.max(
    DAY_START_MINUTES,
    Math.min(DAY_END_MINUTES, totalMinutes)
  );

  const hour = Math.floor(safeMinutes / 60);
  const minute = safeMinutes % 60;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function toDateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getDateFromDateText(dateText: string): Date {
  return new Date(`${dateText}T00:00:00`);
}

export function getDayOfWeekFromDateText(dateText: string): DayOfWeek {
  const date = getDateFromDateText(dateText);

  return DAYS[date.getDay()];
}

export function addDays(date: Date, amount: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + amount);

  return nextDate;
}

export function getStartOfWeekMonday(date: Date): Date {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  return addDays(date, diff);
}

export function getTodayDateOnly(): Date {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function isRoutineActiveOnDate(
  routine: RoutineSchedule,
  dateText: string
): boolean {
  if (routine.isActive === false) {
    return false;
  }

  if (routine.startDate && routine.startDate > dateText) {
    return false;
  }

  if (routine.endDate && routine.endDate < dateText) {
    return false;
  }

  return true;
}

function isRoutineActiveByDate(
  routine: RoutineSchedule,
  referenceDate: Date
): boolean {
  return isRoutineActiveOnDate(routine, toDateOnlyString(referenceDate));
}

function normalizeBusyBlocks(blocks: BusyTimeBlock[]): BusyTimeBlock[] {
  const sortedBlocks = blocks
    .map((block) => ({
      startMinutes: Math.max(
        DAY_START_MINUTES,
        Math.min(DAY_END_MINUTES, block.startMinutes)
      ),
      endMinutes: Math.max(
        DAY_START_MINUTES,
        Math.min(DAY_END_MINUTES, block.endMinutes)
      ),
    }))
    .filter((block) => block.endMinutes > block.startMinutes)
    .sort((a, b) => a.startMinutes - b.startMinutes);

  const mergedBlocks: BusyTimeBlock[] = [];

  for (const block of sortedBlocks) {
    const lastBlock = mergedBlocks[mergedBlocks.length - 1];

    if (!lastBlock) {
      mergedBlocks.push(block);
      continue;
    }

    if (block.startMinutes <= lastBlock.endMinutes) {
      lastBlock.endMinutes = Math.max(lastBlock.endMinutes, block.endMinutes);
    } else {
      mergedBlocks.push(block);
    }
  }

  return mergedBlocks;
}

function calculateFreeTimeFromBusyBlocks(
  busyBlocks: BusyTimeBlock[]
): FreeTimeBlock[] {
  const mergedBusyBlocks = normalizeBusyBlocks(busyBlocks);
  const freeTimeBlocks: FreeTimeBlock[] = [];

  let currentMinutes = DAY_START_MINUTES;

  for (const busyBlock of mergedBusyBlocks) {
    if (busyBlock.startMinutes > currentMinutes) {
      freeTimeBlocks.push({
        startTime: minutesToTime(currentMinutes),
        endTime: minutesToTime(busyBlock.startMinutes),
        minutes: busyBlock.startMinutes - currentMinutes,
      });
    }

    currentMinutes = Math.max(currentMinutes, busyBlock.endMinutes);
  }

  if (currentMinutes < DAY_END_MINUTES) {
    freeTimeBlocks.push({
      startTime: minutesToTime(currentMinutes),
      endTime: minutesToTime(DAY_END_MINUTES),
      minutes: DAY_END_MINUTES - currentMinutes,
    });
  }

  return freeTimeBlocks;
}

export function calculateFreeTimeBlocks({
  dayOfWeek,
  routines,
  referenceDate = new Date(),
}: CalculateFreeTimeBlocksParams): FreeTimeBlock[] {
  const busyBlocks = routines
    .filter((routine) => routine.dayOfWeek === dayOfWeek)
    .filter((routine) => isRoutineActiveByDate(routine, referenceDate))
    .map((routine) => ({
      startMinutes: timeToMinutes(routine.startTime),
      endMinutes: timeToMinutes(routine.endTime),
    }));

  return calculateFreeTimeFromBusyBlocks(busyBlocks);
}

export function calculateFreeTimeBlocksForDate({
  date,
  routines,
  singleSchedules,
}: CalculateFreeTimeBlocksForDateParams): FreeTimeBlock[] {
  const dayOfWeek = getDayOfWeekFromDateText(date);

  const routineBusyBlocks = routines
    .filter((routine) => routine.dayOfWeek === dayOfWeek)
    .filter((routine) => isRoutineActiveOnDate(routine, date))
    .map((routine) => ({
      startMinutes: timeToMinutes(routine.startTime),
      endMinutes: timeToMinutes(routine.endTime),
    }));

  const singleScheduleBusyBlocks = singleSchedules
    .filter((schedule) => schedule.date === date)
    .map((schedule) => ({
      startMinutes: timeToMinutes(schedule.startTime),
      endMinutes: timeToMinutes(schedule.endTime),
    }));

  return calculateFreeTimeFromBusyBlocks([
    ...routineBusyBlocks,
    ...singleScheduleBusyBlocks,
  ]);
}

export function calculateWeeklyFreeTimeBlocks(
  routines: RoutineSchedule[],
  referenceDate: Date = new Date()
): Record<DayOfWeek, FreeTimeBlock[]> {
  const days: DayOfWeek[] = ["월", "화", "수", "목", "금", "토", "일"];

  return days.reduce((result, dayOfWeek) => {
    result[dayOfWeek] = calculateFreeTimeBlocks({
      dayOfWeek,
      routines,
      referenceDate,
    });

    return result;
  }, {} as Record<DayOfWeek, FreeTimeBlock[]>);
}