import {
  addDays,
  getDayOfWeekFromDateText,
  getStartOfWeekMonday,
  getTodayDateOnly,
  timeToMinutes,
  toDateOnlyString,
} from "@/lib/availability";
import {
  SingleSchedule,
  TravelMode,
  TravelTimeEstimate,
  TravelTimeRule,
} from "@/types/calendar";
import type { ExternalCalendarEvent } from "@/types/externalCalendar";
import { RoutineSchedule } from "@/types/routine";

export type ScheduleTravelBlock = {
  id: string;
  title: string;
  sourceType: "routine" | "single" | "external";
  date: string;
  startTime: string;
  endTime: string;
  placeName: string;
};

export type TravelTransition = {
  date: string;
  fromTitle: string;
  toTitle: string;
  fromPlaceName: string;
  toPlaceName: string;
  previousEndTime: string;
  nextStartTime: string;
  gapMinutes: number;
  requiredMinutes: number | null;
  mode: TravelMode;
  cacheKey: string | null;
  status: "same-place" | "enough" | "tight" | "not-enough" | "unknown";
};

const NO_PLACE_TEXT = "위치 미입력";
const TRAVEL_CHECK_GAP_LIMIT_MINUTES = 30;

function normalizePlaceName(placeName: string) {
  return placeName.trim();
}

export function createTravelTimeCacheKey({
  fromPlaceName,
  toPlaceName,
  departureTime,
  mode,
}: {
  fromPlaceName: string;
  toPlaceName: string;
  departureTime: string;
  mode: TravelMode;
}) {
  return [
    normalizePlaceName(fromPlaceName).toLowerCase(),
    departureTime,
    normalizePlaceName(toPlaceName).toLowerCase(),
    mode,
  ].join("|");
}

function isRoutineActiveOnDate(routine: RoutineSchedule, dateText: string) {
  if (routine.isActive === false) {
    return false;
  }

  if (routine.startDate && routine.startDate > dateText) {
    return false;
  }

  if (routine.endDate && routine.endDate < dateText) {
    return false;
  }

  if (routine.cancelledDates?.includes(dateText)) {
    return false;
  }

  return true;
}

function getTravelTimeRule({
  fromPlaceName,
  toPlaceName,
  mode,
  travelTimeRules,
}: {
  fromPlaceName: string;
  toPlaceName: string;
  mode: TravelMode;
  travelTimeRules: TravelTimeRule[];
}) {
  const from = normalizePlaceName(fromPlaceName);
  const to = normalizePlaceName(toPlaceName);

  return travelTimeRules.find((rule) => {
    return (
      rule.minutes > 0 &&
      rule.mode === mode &&
      normalizePlaceName(rule.fromPlaceName) === from &&
      normalizePlaceName(rule.toPlaceName) === to
    );
  });
}

function getTravelTimeEstimate({
  cacheKey,
  travelTimeEstimates,
}: {
  cacheKey: string;
  travelTimeEstimates: TravelTimeEstimate[];
}) {
  return travelTimeEstimates.find((estimate) => {
    return estimate.cacheKey === cacheKey;
  });
}

function getTravelStatus({
  gapMinutes,
  requiredMinutes,
}: {
  gapMinutes: number;
  requiredMinutes: number;
}): TravelTransition["status"] {
  if (gapMinutes < requiredMinutes) {
    return "not-enough";
  }

  if (gapMinutes - requiredMinutes <= 10) {
    return "tight";
  }

  return "enough";
}

export function getScheduleBlocksForDate({
  date,
  routines,
  singleSchedules,
  externalEvents = [],
}: {
  date: string;
  routines: RoutineSchedule[];
  singleSchedules: SingleSchedule[];
  externalEvents?: ExternalCalendarEvent[];
}): ScheduleTravelBlock[] {
  const dayOfWeek = getDayOfWeekFromDateText(date);

  const routineBlocks = routines
    .filter((routine) => routine.dayOfWeek === dayOfWeek)
    .filter((routine) => isRoutineActiveOnDate(routine, date))
    .map((routine) => ({
      id: routine.id,
      title: routine.title,
      sourceType: "routine" as const,
      date,
      startTime: routine.startTime,
      endTime: routine.endTime,
      placeName: routine.placeName || NO_PLACE_TEXT,
    }));

  const singleBlocks = singleSchedules
    .filter((schedule) => schedule.date === date)
    .map((schedule) => ({
      id: schedule.id,
      title: schedule.title,
      sourceType: "single" as const,
      date,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      placeName: schedule.placeName || NO_PLACE_TEXT,
    }));

  // 종일 일정은 이동 구간을 만들 수 없으므로 시간을 점유하는 일정만 쓴다.
  const externalBlocks = externalEvents
    .filter((event) => event.date === date && event.blocksTime)
    .map((event) => ({
      id: event.externalId,
      title: event.title,
      sourceType: "external" as const,
      date,
      startTime: event.startTime,
      endTime: event.endTime,
      placeName: event.placeName || NO_PLACE_TEXT,
    }));

  return [...routineBlocks, ...singleBlocks, ...externalBlocks].sort((a, b) => {
    return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
  });
}

export function calculateTravelTransitionsForDate({
  date,
  routines,
  singleSchedules,
  externalEvents = [],
  travelTimeRules,
  travelTimeEstimates,
  mode,
}: {
  date: string;
  routines: RoutineSchedule[];
  singleSchedules: SingleSchedule[];
  externalEvents?: ExternalCalendarEvent[];
  travelTimeRules: TravelTimeRule[];
  travelTimeEstimates?: TravelTimeEstimate[];
  mode: TravelMode;
}): TravelTransition[] {
  const blocks = getScheduleBlocksForDate({
    date,
    routines,
    externalEvents,
    singleSchedules,
  });

  const transitions: TravelTransition[] = [];

  for (let index = 0; index < blocks.length - 1; index += 1) {
    const current = blocks[index];
    const next = blocks[index + 1];
    const fromPlaceName = normalizePlaceName(current.placeName);
    const toPlaceName = normalizePlaceName(next.placeName);
    const gapMinutes =
      timeToMinutes(next.startTime) - timeToMinutes(current.endTime);

    if (gapMinutes < 0 || gapMinutes > TRAVEL_CHECK_GAP_LIMIT_MINUTES) {
      continue;
    }

    if (
      !fromPlaceName ||
      !toPlaceName ||
      fromPlaceName === NO_PLACE_TEXT ||
      toPlaceName === NO_PLACE_TEXT
    ) {
      transitions.push({
        date,
        fromTitle: current.title,
        toTitle: next.title,
        fromPlaceName: fromPlaceName || NO_PLACE_TEXT,
        toPlaceName: toPlaceName || NO_PLACE_TEXT,
        previousEndTime: current.endTime,
        nextStartTime: next.startTime,
        gapMinutes,
        requiredMinutes: null,
        mode,
        cacheKey: null,
        status: "unknown",
      });
      continue;
    }

    if (fromPlaceName === toPlaceName) {
      continue;
    }

    const cacheKey = createTravelTimeCacheKey({
      fromPlaceName,
      toPlaceName,
      departureTime: current.endTime,
      mode,
    });
    const estimate = getTravelTimeEstimate({
      cacheKey,
      travelTimeEstimates: travelTimeEstimates ?? [],
    });

    if (estimate) {
      transitions.push({
        date,
        fromTitle: current.title,
        toTitle: next.title,
        fromPlaceName,
        toPlaceName,
        previousEndTime: current.endTime,
        nextStartTime: next.startTime,
        gapMinutes,
        requiredMinutes: estimate.minutes,
        mode,
        cacheKey,
        status: getTravelStatus({
          gapMinutes,
          requiredMinutes: estimate.minutes,
        }),
      });
      continue;
    }

    const rule = getTravelTimeRule({
      fromPlaceName,
      toPlaceName,
      mode,
      travelTimeRules,
    });

    if (!rule) {
      transitions.push({
        date,
        fromTitle: current.title,
        toTitle: next.title,
        fromPlaceName,
        toPlaceName,
        previousEndTime: current.endTime,
        nextStartTime: next.startTime,
        gapMinutes,
        requiredMinutes: null,
        mode,
        cacheKey,
        status: "unknown",
      });
      continue;
    }

    transitions.push({
      date,
      fromTitle: current.title,
      toTitle: next.title,
      fromPlaceName,
      toPlaceName,
      previousEndTime: current.endTime,
      nextStartTime: next.startTime,
      gapMinutes,
      requiredMinutes: rule.minutes,
      mode,
      cacheKey,
      status: getTravelStatus({
        gapMinutes,
        requiredMinutes: rule.minutes,
      }),
    });
  }

  return transitions;
}

export function calculateWeeklyTravelTransitions({
  routines,
  singleSchedules,
  externalEvents = [],
  travelTimeRules,
  travelTimeEstimates,
  mode,
  referenceDate = getTodayDateOnly(),
}: {
  routines: RoutineSchedule[];
  singleSchedules: SingleSchedule[];
  externalEvents?: ExternalCalendarEvent[];
  travelTimeRules: TravelTimeRule[];
  travelTimeEstimates?: TravelTimeEstimate[];
  mode: TravelMode;
  referenceDate?: Date;
}) {
  const startOfWeek = getStartOfWeekMonday(referenceDate);
  const dates = Array.from({ length: 7 }, (_, index) => {
    return toDateOnlyString(addDays(startOfWeek, index));
  });

  return dates.flatMap((date) => {
    return calculateTravelTransitionsForDate({
      date,
      routines,
      singleSchedules,
      externalEvents,
      travelTimeRules,
      travelTimeEstimates,
      mode,
    });
  });
}
