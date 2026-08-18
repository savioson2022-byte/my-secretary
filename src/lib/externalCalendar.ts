import { Capacitor, registerPlugin } from "@capacitor/core";
import type {
  ExternalCalendarEvent,
  ExternalCalendarSource,
  ExternalCalendarStatus,
} from "@/types/externalCalendar";
import { UNAVAILABLE_EXTERNAL_CALENDAR_STATUS } from "@/types/externalCalendar";
import {
  getEnabledCalendarIds,
  getExternalCalendarSettings,
} from "@/lib/externalCalendarSettings";

/**
 * 외부 캘린더 읽기 진입점.
 *
 * 어느 플랫폼에서도 예외를 던지지 않는다. 권한이 없거나 플러그인이 없으면
 * 빈 값으로 떨어지고, 앱은 캘린더 연동 없이 지금처럼 동작한다.
 *
 * 설계 문서: docs/calendar-integration-plan.md
 */

const PLUGIN_NAME = "CalendarBridge";

type CalendarBridgePlugin = {
  getStatus(): Promise<ExternalCalendarStatus>;
  requestAccess(): Promise<ExternalCalendarStatus>;
  listCalendars(): Promise<{ calendars: ExternalCalendarSource[] }>;
  fetchEvents(options: {
    startDate: string;
    endDate: string;
    calendarIds?: string[];
  }): Promise<{ events: ExternalCalendarEvent[] }>;
  addListener(
    eventName: "calendarChanged",
    listener: () => void
  ): Promise<{ remove: () => Promise<void> }>;
};

const CalendarBridge = registerPlugin<CalendarBridgePlugin>(PLUGIN_NAME);

function isNativeCalendarPlatform() {
  // 안드로이드는 CalendarContract 구현 이후에 추가한다.
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

export async function getExternalCalendarStatus(): Promise<ExternalCalendarStatus> {
  if (!isNativeCalendarPlatform()) {
    return UNAVAILABLE_EXTERNAL_CALENDAR_STATUS;
  }

  if (!Capacitor.isPluginAvailable(PLUGIN_NAME)) {
    return {
      ...UNAVAILABLE_EXTERNAL_CALENDAR_STATUS,
      reason: "appUpdateRequired",
    };
  }

  try {
    return await CalendarBridge.getStatus();
  } catch {
    return { ...UNAVAILABLE_EXTERNAL_CALENDAR_STATUS, reason: "bridgeError" };
  }
}

/**
 * 사용자가 캘린더 연동을 켜는 순간에만 호출한다.
 * 앱을 처음 열 때 미리 물어보지 않는다.
 */
export async function requestExternalCalendarAccess(): Promise<ExternalCalendarStatus> {
  const status = await getExternalCalendarStatus();

  if (!status.available) return status;

  try {
    return await CalendarBridge.requestAccess();
  } catch {
    return { ...UNAVAILABLE_EXTERNAL_CALENDAR_STATUS, reason: "bridgeError" };
  }
}

export async function listExternalCalendarSources(): Promise<
  ExternalCalendarSource[]
> {
  const status = await getExternalCalendarStatus();

  if (!status.available || status.authorizationState !== "fullAccess") {
    return [];
  }

  try {
    const { calendars } = await CalendarBridge.listCalendars();
    return calendars ?? [];
  } catch {
    return [];
  }
}

export async function fetchExternalCalendarEvents(options: {
  startDate: string;
  endDate: string;
  /** 비우면 생일 캘린더를 제외한 전체를 읽는다. */
  calendarIds?: string[];
}): Promise<ExternalCalendarEvent[]> {
  const status = await getExternalCalendarStatus();

  if (!status.available || status.authorizationState !== "fullAccess") {
    return [];
  }

  try {
    const { events } = await CalendarBridge.fetchEvents(options);
    // 있는 그대로 돌려준다. 앱이 만든 일정을 걸러내는 것은 아래 loader의 역할이다.
    return events ?? [];
  } catch {
    return [];
  }
}

/**
 * 다른 앱에서 캘린더가 바뀌면 호출된다.
 * 반환값을 부르면 구독을 해제한다.
 */
export function onExternalCalendarChanged(listener: () => void): () => void {
  if (!isNativeCalendarPlatform() || !Capacitor.isPluginAvailable(PLUGIN_NAME)) {
    return () => {};
  }

  let removeHandle: (() => Promise<void>) | null = null;
  let cancelled = false;

  void CalendarBridge.addListener("calendarChanged", listener)
    .then((handle) => {
      if (cancelled) {
        void handle.remove();
        return;
      }
      removeHandle = handle.remove;
    })
    .catch(() => {
      // 리스너를 붙이지 못해도 화면 진입 시 다시 읽으므로 치명적이지 않다.
    });

  return () => {
    cancelled = true;
    void removeHandle?.();
  };
}

/**
 * 사용자가 켜둔 캘린더만 골라 읽는다.
 * 훅을 쓸 수 없는 곳(알림 계산, 이벤트 핸들러)에서 쓴다.
 */
export async function loadEnabledExternalCalendarEvents({
  startDate,
  endDate,
  includeAppCreated = false,
}: {
  startDate: string;
  endDate: string;
  /** 진단 화면처럼 읽어온 그대로를 봐야 할 때만 켠다. */
  includeAppCreated?: boolean;
}): Promise<ExternalCalendarEvent[]> {
  const settings = getExternalCalendarSettings();

  if (!settings.enabled) return [];

  const sources = await listExternalCalendarSources();
  const calendarIds = getEnabledCalendarIds(sources, settings);

  // 캘린더는 있는데 전부 꺼둔 경우와, 아직 목록을 못 읽은 경우를 구분한다.
  if (sources.length > 0 && calendarIds.length === 0) return [];

  const events = await fetchExternalCalendarEvents({
    startDate,
    endDate,
    calendarIds,
  });

  if (includeAppCreated) return events;

  // 앱이 직접 쓴 일정은 이미 단기 일정으로 들고 있으므로 중복 계산하지 않는다.
  return events.filter((event) => !event.createdByApp);
}

/** 빈 시간 계산에 넣을 수 있는 일정만 남긴다. */
export function selectTimeBlockingEvents(
  events: ExternalCalendarEvent[],
  date: string
): ExternalCalendarEvent[] {
  return events.filter((event) => event.date === date && event.blocksTime);
}
