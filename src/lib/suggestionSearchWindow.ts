import { addDays, getTodayDateOnly, toDateOnlyString } from "@/lib/availability";

/**
 * 외부 캘린더를 읽어올 기본 범위.
 *
 * 알림 생성 창(notificationEventBuilder의 14일)보다 넓게 잡아
 * 월간 캘린더와 시간작업 추천까지 한 번에 커버한다.
 */
export const EXTERNAL_CALENDAR_PAST_DAYS = 7;
export const EXTERNAL_CALENDAR_FUTURE_DAYS = 90;

/** 알림은 앞으로 14일만 만든다. notificationEventBuilder의 SYNC_WINDOW_DAYS와 맞춘다. */
export const NOTIFICATION_WINDOW_DAYS = 14;

export function getNotificationSearchWindow(referenceDate = getTodayDateOnly()) {
  return {
    startDate: toDateOnlyString(referenceDate),
    endDate: toDateOnlyString(addDays(referenceDate, NOTIFICATION_WINDOW_DAYS)),
  };
}

export function getSuggestionSearchWindow(referenceDate = getTodayDateOnly()) {
  return {
    startDate: toDateOnlyString(addDays(referenceDate, -EXTERNAL_CALENDAR_PAST_DAYS)),
    endDate: toDateOnlyString(addDays(referenceDate, EXTERNAL_CALENDAR_FUTURE_DAYS)),
  };
}
