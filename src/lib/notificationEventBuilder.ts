import {
  addDays,
  calculateFreeTimeBlocksForDate,
  getDayOfWeekFromDateText,
  toDateOnlyString,
} from "@/lib/availability";
import { decideNextAction } from "@/lib/agentNextAction";
import { getSavedPlaces } from "@/lib/placeStorage";
import { getPurchaseHistories } from "@/lib/purchaseHistoryStorage";
import { getRoutineSchedules } from "@/lib/routineStorage";
import { getSingleSchedules } from "@/lib/singleScheduleStorage";
import { getItems } from "@/lib/storage";
import type { AssistantItem } from "@/types/assistant";
import type { SavedPlace, SingleSchedule } from "@/types/calendar";
import type { ExternalCalendarEvent } from "@/types/externalCalendar";
import type {
  NotificationEvent,
  NotificationEventType,
  NotificationSettings,
} from "@/types/notification";
import type { PurchaseHistoryItem } from "@/types/purchaseHistory";
import type { RoutineSchedule } from "@/types/routine";

const SYNC_WINDOW_DAYS = 14;

function shouldRepeatPersistentAlarm(
  event: NotificationEvent,
  settings: NotificationSettings
) {
  if (!settings.persistentAlarmEnabled) return false;
  if (event.eventType === "prep_start") {
    return settings.persistentAlarmPrepEnabled;
  }
  if (event.eventType === "travel_start") {
    return settings.persistentAlarmTravelEnabled;
  }
  if (event.eventType === "schedule_start") {
    return settings.persistentAlarmScheduleStartEnabled;
  }
  return false;
}

function expandPersistentAlarmEvents(
  events: NotificationEvent[],
  settings: NotificationSettings
) {
  const repeatCount = Math.max(
    1,
    Math.min(10, settings.persistentAlarmRepeatCount)
  );
  const intervalMinutes = Math.max(
    1,
    Math.min(10, settings.persistentAlarmIntervalMinutes)
  );

  return events.flatMap((event) => {
    if (!shouldRepeatPersistentAlarm(event, settings)) return [event];

    const groupId = event.id;
    const startsAt = new Date(event.scheduledAt).getTime();

    return Array.from({ length: repeatCount }, (_, index) => ({
      ...event,
      id: `${groupId}:persistent:${index}`,
      scheduledAt: new Date(
        startsAt + index * intervalMinutes * 60 * 1000
      ).toISOString(),
      title:
        index === 0
          ? event.title
          : `${event.title} · 확인 필요 (${index + 1}/${repeatCount})`,
      priority: "urgent" as const,
      requireInteraction: true,
      deliveryChannels:
        index === 0
          ? event.deliveryChannels
          : event.deliveryChannels?.filter(
              (channel) => channel !== "native_push"
            ),
      payload: {
        ...(event.payload ?? {}),
        persistentAlarm: true,
        persistentAlarmGroupId: groupId,
        persistentAlarmRepeatIndex: index,
        persistentAlarmRepeatCount: repeatCount,
        persistentAlarmIntervalMinutes: intervalMinutes,
        originalEventId: groupId,
        eventType: event.eventType,
      },
    }));
  });
}

function getDeliveryChannels(settings: NotificationSettings) {
  return [
    ...(settings.inAppAlarmEnabled ? (["in_app"] as const) : []),
    ...(settings.pushEnabled
      ? (["web_push", "native_push"] as const)
      : []),
  ];
}

function getEventDeliveryOptions(settings: NotificationSettings) {
  return {
    deliveryChannels: getDeliveryChannels(settings),
    soundEnabled: settings.soundEnabled,
    soundKey: settings.soundEnabled ? "default" : "silent",
  };
}

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
    | "id"
    | "title"
    | "startTime"
    | "placeName"
    | "placeAddress"
    | "travelMode"
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
    notificationType: "time_based" as const,
    ...getEventDeliveryOptions(settings),
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
          payload: {
            scheduleTitle: schedule.title,
            scheduleStartAt: toDateTimeIso(dateText, schedule.startTime),
            travelMode: schedule.travelMode ?? settings.preferredTravelMode,
          },
        },
        place
      )
    );
  }

  if (
    sourceType === "routine" &&
    settings.repeatingNotificationsEnabled &&
    settings.routineReminderEnabled
  ) {
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
    notificationType: "time_based",
    ...getEventDeliveryOptions(settings),
  };
}

function getRemainingGoalAmount(item: AssistantItem) {
  if (!item.goalTotalAmount) return null;

  return Math.max(0, item.goalTotalAmount - (item.goalCompletedAmount ?? 0));
}

function getInclusiveDayCount(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1);
}

function createTimeTaskEvent({
  item,
  dateText,
  settings,
}: {
  item: AssistantItem;
  dateText: string;
  settings: NotificationSettings;
}): NotificationEvent | null {
  const isPeriodTask = Boolean(item.goalStartDate && item.dueDate);

  if (
    (isPeriodTask && !settings.periodTaskNotificationsEnabled) ||
    (!isPeriodTask && !settings.timeTaskNotificationsEnabled)
  ) {
    return null;
  }

  if (item.goalStartDate && dateText < item.goalStartDate) return null;
  if (item.dueDate && dateText > item.dueDate) return null;

  const remainingAmount = getRemainingGoalAmount(item);
  const remainingDays = item.dueDate
    ? getInclusiveDayCount(dateText, item.dueDate)
    : null;
  const todayAmount =
    remainingAmount !== null && remainingDays
      ? Math.ceil(remainingAmount / remainingDays)
      : null;
  const unit = item.goalUnit ?? "";
  const body = todayAmount
    ? `오늘 ${todayAmount}${unit} 진행하면 마감까지 맞출 수 있어요. 남은 분량 ${remainingAmount}${unit}.`
    : item.estimatedMinutes
      ? `오늘 ${item.estimatedMinutes}분 분량을 확인해 보세요.`
      : "오늘 진행할 분량을 확인해 보세요.";
  const eventType = isPeriodTask ? "period_task" : "time_task";

  return {
    id: createEventId({ eventType, sourceId: item.id, occurrenceDate: dateText }),
    eventType,
    sourceType: "assistant_item",
    sourceId: item.id,
    occurrenceDate: dateText,
    scheduledAt: toDateTimeIso(dateText, settings.dailySummaryTime || "08:00"),
    title: isPeriodTask ? `오늘 ${item.title} 목표예요` : `오늘 ${item.title} 시간을 잡아볼까요?`,
    body,
    url: "/calendar/weekly",
    placeName: "",
    requiresLocationCheck: false,
    notificationType: isPeriodTask ? "period_task" : "time_task",
    ...getEventDeliveryOptions(settings),
  };
}

/**
 * 알림 계산에 필요한 모든 데이터. 저장소를 직접 읽지 않으므로
 * 브라우저 밖(서버 에이전트 루프)에서도 그대로 호출할 수 있다.
 */
export type NotificationEventInput = {
  settings: NotificationSettings;
  items: AssistantItem[];
  routines: RoutineSchedule[];
  singleSchedules: SingleSchedule[];
  savedPlaces: SavedPlace[];
  purchaseHistories: PurchaseHistoryItem[];
  /**
   * 시스템 캘린더 일정. 빈 시간 계산에만 쓴다.
   * 사용자가 앱에 직접 넣지 않은 일정으로 알람을 울리지는 않는다.
   */
  externalEvents?: ExternalCalendarEvent[];
  referenceDate?: Date;
};

/** 저장소에 의존하지 않는 순수 계산. */
export function buildNotificationEventsFrom({
  settings,
  items,
  routines,
  singleSchedules,
  savedPlaces,
  purchaseHistories,
  externalEvents = [],
  referenceDate,
}: NotificationEventInput): NotificationEvent[] {
  if (!settings.notificationsEnabled) return [];

  const today = referenceDate ?? new Date();
  const activeTimeTasks = items.filter(
    (item) => item.status === "미완료" && item.processType === "시간작업"
  );
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

    activeTimeTasks.forEach((item) => {
      const event = createTimeTaskEvent({ item, dateText, settings });

      if (event) events.push(event);
    });

    if (settings.dailySummaryEnabled) {
      const scheduleCount =
        singleSchedules.filter((schedule) => schedule.date === dateText).length +
        routines.filter(
          (routine) =>
            routine.dayOfWeek === dayOfWeek && isRoutineActiveOnDate(routine, dateText)
        ).length;

      // 아침 브리핑은 숫자만 나열하지 않고 "먼저 할 것 하나"를 말한다.
      const morningAction = decideNextAction({
        items,
        routines,
        singleSchedules,
        savedPlaces,
        externalEvents,
        now: new Date(`${dateText}T09:00:00`),
      });

      events.push({
        id: createEventId({
          eventType: "daily_summary",
          sourceId: "daily-summary",
          occurrenceDate: dateText,
        }),
        eventType: "daily_summary",
        sourceType: "ai",
        sourceId: "daily-summary",
        occurrenceDate: dateText,
        scheduledAt: toDateTimeIso(dateText, settings.dailySummaryTime || "08:00"),
        title:
          morningAction.kind === "clear"
            ? "오늘은 여유가 있어요"
            : `먼저 할 것: ${morningAction.title}`,
        body:
          morningAction.kind === "clear"
            ? `일정 ${scheduleCount}개가 있어요. 급한 건 없습니다.`
            : `${morningAction.body} · 오늘 일정 ${scheduleCount}개`,
        url: morningAction.url,
        placeName: "",
        requiresLocationCheck: false,
        notificationType: "daily_summary",
        ...getEventDeliveryOptions(settings),
      });
    }

    if (settings.eveningReviewEnabled) {
      const doneToday = items.filter(
        (item) => item.status === "완료" && item.updatedAt.slice(0, 10) === dateText
      ).length;
      const leftToday = items.filter(
        (item) =>
          item.status === "미완료" &&
          item.dueDate &&
          item.dueDate.slice(0, 10) <= dateText
      );

      events.push({
        id: createEventId({
          eventType: "evening_review",
          sourceId: "evening-review",
          occurrenceDate: dateText,
        }),
        eventType: "evening_review",
        sourceType: "ai",
        sourceId: "evening-review",
        occurrenceDate: dateText,
        scheduledAt: toDateTimeIso(dateText, settings.eveningReviewTime || "21:00"),
        title:
          leftToday.length > 0
            ? `오늘 못 한 게 ${leftToday.length}개 있어요`
            : "오늘 할 일은 다 정리됐어요",
        body:
          leftToday.length > 0
            ? `${leftToday[0].title} 외 ${Math.max(0, leftToday.length - 1)}개. 내일로 옮길까요?`
            : `오늘 ${doneToday}개를 끝냈어요.`,
        url: "/records",
        placeName: "",
        requiresLocationCheck: false,
        notificationType: "daily_summary",
        ...getEventDeliveryOptions(settings),
      });
    }

    if (settings.aiRecommendationsEnabled && activeTimeTasks.length > 0) {
      const freeMinutes = calculateFreeTimeBlocksForDate({
        date: dateText,
        routines,
        singleSchedules,
        externalEvents,
      }).reduce((total, block) => total + block.minutes, 0);
      const recommendedItem = activeTimeTasks.find(
        (item) => !item.dueDate || item.dueDate >= dateText
      );

      if (recommendedItem && freeMinutes >= 30) {
        events.push({
          id: createEventId({
            eventType: "ai_recommendation",
            sourceId: recommendedItem.id,
            occurrenceDate: dateText,
          }),
          eventType: "ai_recommendation",
          sourceType: "ai",
          sourceId: recommendedItem.id,
          occurrenceDate: dateText,
          scheduledAt: toDateTimeIso(dateText, settings.dailySummaryTime || "08:00"),
          title: `오늘 ${Math.floor(freeMinutes / 60)}시간 ${freeMinutes % 60}분 비어 있어요`,
          body: `${recommendedItem.title}을(를) 진행하기 좋은 날이에요.`,
          url: "/calendar/weekly",
          placeName: "",
          requiresLocationCheck: false,
          notificationType: "ai_recommendation",
          ...getEventDeliveryOptions(settings),
        });
      }
    }
  }

  purchaseHistories.forEach((history) => {
    const event = createPurchaseEvent({ history, settings });

    if (event) {
      events.push(event);
    }
  });

  return expandPersistentAlarmEvents(events, settings).sort((left, right) => {
    return new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime();
  });
}

/**
 * 브라우저에서 저장소를 읽어 위 순수 함수를 호출하는 얇은 래퍼.
 * 기존 호출부는 그대로 두고, 서버로 옮길 때는 buildNotificationEventsFrom을 쓴다.
 */
export function buildNotificationEvents(
  settings: NotificationSettings,
  externalEvents: ExternalCalendarEvent[] = []
): NotificationEvent[] {
  return buildNotificationEventsFrom({
    settings,
    items: getItems(),
    routines: getRoutineSchedules(),
    singleSchedules: getSingleSchedules(),
    savedPlaces: getSavedPlaces(),
    purchaseHistories: getPurchaseHistories(),
    externalEvents,
  });
}
