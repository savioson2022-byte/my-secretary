import { addDays, getDayOfWeekFromDateText, toDateOnlyString } from "@/lib/availability";
import { getSavedPlaces } from "@/lib/placeStorage";
import { getPurchaseHistories } from "@/lib/purchaseHistoryStorage";
import { getRoutineSchedules } from "@/lib/routineStorage";
import { getSingleSchedules } from "@/lib/singleScheduleStorage";
import type { SavedPlace, SingleSchedule } from "@/types/calendar";
import type {
  NotificationEvent,
  NotificationEventType,
  NotificationSettings,
} from "@/types/notification";
import type { PurchaseHistoryItem } from "@/types/purchaseHistory";
import type { RoutineSchedule } from "@/types/routine";

const SYNC_WINDOW_DAYS = 14;

function toDateTimeIso(dateText: string, timeText: string) {
  return new Date(`${dateText}T${timeText}:00`).toISOString();
}

function addMinutes(date: Date, minutes: number) {
  const nextDate = new Date(date);
  nextDate.setMinutes(nextDate.getMinutes() + minutes);

  return nextDate;
}

function getTimeBefore(dateText: string, timeText: string, minutes: number) {
  return addMinutes(new Date(`${dateText}T${timeText}:00`), -minutes).toISOString();
}

function isRoutineActiveOnDate(routine: RoutineSchedule, dateText: string) {
  if (routine.isActive === false) return false;
  if (routine.startDate && routine.startDate > dateText) return false;
  if (routine.endDate && routine.endDate < dateText) return false;
  if (routine.cancelledDates?.includes(dateText)) return false;

  return true;
}

function normalizeText(value: string | undefined | null) {
  return (value ?? "").trim().toLowerCase();
}

function findSavedPlace({
  placeName,
  placeAddress,
  savedPlaces,
}: {
  placeName: string;
  placeAddress?: string;
  savedPlaces: SavedPlace[];
}) {
  const normalizedName = normalizeText(placeName);
  const normalizedAddress = normalizeText(placeAddress);

  if (!normalizedName && !normalizedAddress) return null;

  return (
    savedPlaces.find((place) => {
      return (
        normalizeText(place.name) === normalizedName ||
        (!!normalizedAddress && normalizeText(place.address) === normalizedAddress)
      );
    }) ?? null
  );
}

function createEventId({
  eventType,
  sourceId,
  occurrenceDate,
}: {
  eventType: NotificationEventType;
  sourceId: string;
  occurrenceDate: string;
}) {
  return `${eventType}:${sourceId}:${occurrenceDate}`;
}

function withPlaceCoordinates(
  event: NotificationEvent,
  place: SavedPlace | null
): NotificationEvent {
  if (!place?.latitude || !place?.longitude) {
    return event;
  }

  return {
    ...event,
    latitude: place.latitude,
    longitude: place.longitude,
  };
}

function createScheduleEvents({
  schedule,
  sourceType,
  dateText,
  settings,
  savedPlaces,
  url,
}: {
  schedule: Pick<
    SingleSchedule | RoutineSchedule,
    "id" | "title" | "startTime" | "placeName" | "placeAddress"
  >;
  sourceType: "single" | "routine";
  dateText: string;
  settings: NotificationSettings;
  savedPlaces: SavedPlace[];
  url: string;
}) {
  const events: NotificationEvent[] = [];
  const place = findSavedPlace({
    placeName: schedule.placeName,
    placeAddress: schedule.placeAddress,
    savedPlaces,
  });
  const placeText = schedule.placeName ? ` · ${schedule.placeName}` : "";
  const base = {
    sourceType,
    sourceId: schedule.id,
    occurrenceDate: dateText,
    placeName: schedule.placeName,
    placeAddress: schedule.placeAddress,
    url,
  };

  if (settings.scheduleNotificationsEnabled) {
    events.push(
      withPlaceCoordinates(
        {
          ...base,
          id: createEventId({
            eventType: "schedule_start",
            sourceId: schedule.id,
            occurrenceDate: dateText,
          }),
          eventType: "schedule_start",
          scheduledAt: toDateTimeIso(dateText, schedule.startTime),
          title: `${schedule.title} 시작 시간이에요`,
          body: `${schedule.startTime}${placeText}`,
          requiresLocationCheck: false,
        },
        place
      )
    );

    events.push(
      withPlaceCoordinates(
        {
          ...base,
          id: createEventId({
            eventType: "prep_start",
            sourceId: schedule.id,
            occurrenceDate: dateText,
          }),
          eventType: "prep_start",
          scheduledAt: getTimeBefore(
            dateText,
            schedule.startTime,
            settings.defaultPrepLeadMinutes
          ),
          title: `${schedule.title} 준비를 시작할 시간이에요`,
          body: `${settings.defaultPrepLeadMinutes}분 뒤 시작${placeText}`,
          requiresLocationCheck: false,
        },
        place
      )
    );
  }

  if (
    settings.travelNotificationsEnabled &&
    settings.locationNotificationsEnabled &&
    schedule.placeName
  ) {
    events.push(
      withPlaceCoordinates(
        {
          ...base,
          id: createEventId({
            eventType: "travel_start",
            sourceId: schedule.id,
            occurrenceDate: dateText,
          }),
          eventType: "travel_start",
          scheduledAt: getTimeBefore(
            dateText,
            schedule.startTime,
            settings.defaultPrepLeadMinutes + settings.travelBufferMinutes
          ),
          title: `${schedule.title} 이동을 확인할 시간이에요`,
          body: `현재 위치와 ${schedule.placeName} 거리를 확인해 출발 시간을 판단합니다.`,
          requiresLocationCheck: true,
        },
        place
      )
    );
  }

  if (sourceType === "routine" && settings.routineReminderEnabled) {
    events.push(
      withPlaceCoordinates(
        {
          ...base,
          id: createEventId({
            eventType: "routine_reminder",
            sourceId: schedule.id,
            occurrenceDate: dateText,
          }),
          eventType: "routine_reminder",
          scheduledAt: getTimeBefore(dateText, schedule.startTime, 5),
          title: `${schedule.title} 루틴을 잊지 마세요`,
          body: `${schedule.startTime}${placeText}`,
          requiresLocationCheck: false,
        },
        place
      )
    );
  }

  return events;
}

function createPurchaseEvent({
  history,
  settings,
}: {
  history: PurchaseHistoryItem;
  settings: NotificationSettings;
}): NotificationEvent | null {
  if (
    !settings.purchaseNotificationsEnabled ||
    !history.autoRepurchaseEnabled ||
    !history.nextPurchaseCheckDate
  ) {
    return null;
  }

  return {
    id: createEventId({
      eventType: "purchase_recommendation",
      sourceId: history.id,
      occurrenceDate: history.nextPurchaseCheckDate,
    }),
    eventType: "purchase_recommendation",
    sourceType: "purchase",
    sourceId: history.id,
    occurrenceDate: history.nextPurchaseCheckDate,
    scheduledAt: toDateTimeIso(history.nextPurchaseCheckDate, "09:00"),
    title: `${history.productName} 재구매 확인일이에요`,
    body: history.maxBudgetKrw
      ? `${history.maxBudgetKrw.toLocaleString("ko-KR")}원 이하로 확인해보세요.`
      : "구매 준비에서 상품을 확인해보세요.",
    url: "/purchase",
    placeName: "",
    requiresLocationCheck: false,
  };
}

export function buildNotificationEvents(settings: NotificationSettings) {
  const today = new Date();
  const savedPlaces = getSavedPlaces();
  const routines = getRoutineSchedules();
  const singleSchedules = getSingleSchedules();
  const purchaseHistories = getPurchaseHistories();
  const events: NotificationEvent[] = [];

  for (let dayOffset = 0; dayOffset < SYNC_WINDOW_DAYS; dayOffset += 1) {
    const dateText = toDateOnlyString(addDays(today, dayOffset));
    const dayOfWeek = getDayOfWeekFromDateText(dateText);

    singleSchedules
      .filter((schedule) => schedule.date === dateText)
      .forEach((schedule) => {
        events.push(
          ...createScheduleEvents({
            schedule,
            sourceType: "single",
            dateText,
            settings,
            savedPlaces,
            url: "/calendar/weekly",
          })
        );
      });

    routines
      .filter((routine) => {
        return (
          routine.dayOfWeek === dayOfWeek &&
          isRoutineActiveOnDate(routine, dateText)
        );
      })
      .forEach((routine) => {
        events.push(
          ...createScheduleEvents({
            schedule: routine,
            sourceType: "routine",
            dateText,
            settings,
            savedPlaces,
            url: "/calendar/weekly",
          })
        );
      });
  }

  purchaseHistories.forEach((history) => {
    const event = createPurchaseEvent({ history, settings });

    if (event) {
      events.push(event);
    }
  });

  return events.sort((left, right) => {
    return new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime();
  });
}
