"use client";

import type {
  NotificationEvent,
  NotificationSettings,
} from "@/types/notification";
import type { TravelMode } from "@/types/calendar";

type CurrentCoordinates = {
  latitude: number;
  longitude: number;
};

type TravelEstimate = {
  ok: boolean;
  minutes?: number;
  distanceMeters?: number;
  atDestination?: boolean;
  provider?: string;
};

const POSITION_CACHE_MS = 2 * 60 * 1000;
const DESTINATION_REMINDER_MINUTES = 5;
let cachedPosition:
  | { coordinates: CurrentCoordinates; capturedAt: number }
  | null = null;

async function getCurrentCoordinates(): Promise<CurrentCoordinates | null> {
  if (
    cachedPosition &&
    Date.now() - cachedPosition.capturedAt < POSITION_CACHE_MS
  ) {
    return cachedPosition.coordinates;
  }

  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { Geolocation } = await import("@capacitor/geolocation");
      const permission = await Geolocation.requestPermissions();
      if (permission.location !== "granted") return null;

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: POSITION_CACHE_MS,
      });
      const coordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      cachedPosition = { coordinates, capturedAt: Date.now() };
      return coordinates;
    }
  } catch {
    // 웹 위치 API로 이어서 확인합니다.
  }

  if (!("geolocation" in navigator)) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        cachedPosition = { coordinates, capturedAt: Date.now() };
        resolve(coordinates);
      },
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: POSITION_CACHE_MS,
      }
    );
  });
}

function getPersistentGroupId(event: NotificationEvent) {
  return typeof event.payload?.persistentAlarmGroupId === "string"
    ? event.payload.persistentAlarmGroupId
    : event.id;
}

function getRepeatIndex(event: NotificationEvent) {
  const value = Number(event.payload?.persistentAlarmRepeatIndex);
  return Number.isFinite(value) ? value : 0;
}

function getIntervalMinutes(event: NotificationEvent) {
  const value = Number(event.payload?.persistentAlarmIntervalMinutes);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function formatDepartureTime(value: Date) {
  return value.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function estimateTravel({
  current,
  event,
  mode,
}: {
  current: CurrentCoordinates;
  event: NotificationEvent;
  mode: TravelMode;
}) {
  const response = await fetch("/api/travel-time", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fromLatitude: current.latitude,
      fromLongitude: current.longitude,
      toLatitude: event.latitude,
      toLongitude: event.longitude,
      toAddress: event.placeAddress,
      toPlaceName: event.placeName,
      mode,
      departureTime: new Date().toISOString(),
    }),
  });

  if (!response.ok) return null;
  const result = (await response.json()) as TravelEstimate;
  return result.ok ? result : null;
}

export async function adaptLocationAwareNotificationEvents(
  events: NotificationEvent[],
  settings: NotificationSettings
) {
  if (
    !settings.locationNotificationsEnabled ||
    !settings.travelNotificationsEnabled
  ) {
    return events;
  }

  const now = Date.now();
  const checkWindowMs =
    Math.max(15, settings.locationCheckWindowMinutes) * 60 * 1000;
  const baseTravelEvents = events.filter((event) => {
    const startAt = Number(event.payload?.scheduleStartAt
      ? new Date(String(event.payload.scheduleStartAt)).getTime()
      : NaN);
    return (
      event.eventType === "travel_start" &&
      getRepeatIndex(event) === 0 &&
      Number.isFinite(startAt) &&
      startAt > now &&
      startAt <= now + checkWindowMs &&
      Number.isFinite(event.latitude) &&
      Number.isFinite(event.longitude)
    );
  });

  if (baseTravelEvents.length === 0) return events;
  const current = await getCurrentCoordinates();
  if (!current) return events;

  const adaptations = new Map<
    string,
    {
      scheduledAt: number;
      title: string;
      body: string;
      estimate: TravelEstimate;
    }
  >();

  await Promise.all(
    baseTravelEvents.slice(0, 6).map(async (event) => {
      const mode = (event.payload?.travelMode ??
        settings.preferredTravelMode) as TravelMode;
      const estimate = await estimateTravel({ current, event, mode });
      if (!estimate) return;

      const startAt = new Date(
        String(event.payload?.scheduleStartAt)
      ).getTime();
      const scheduleTitle =
        typeof event.payload?.scheduleTitle === "string"
          ? event.payload.scheduleTitle
          : event.title.replace(" 이동을 확인할 시간이에요", "");
      const placeName = event.placeName || "일정 장소";

      if (estimate.atDestination) {
        adaptations.set(getPersistentGroupId(event), {
          scheduledAt: Math.max(
            now + 10_000,
            startAt - DESTINATION_REMINDER_MINUTES * 60 * 1000
          ),
          title: `현 위치는 ${placeName}입니다`,
          body: `곧 ${scheduleTitle} 일정입니다. 시작 준비를 확인해 주세요.`,
          estimate,
        });
        return;
      }

      const minutes = Math.max(1, estimate.minutes ?? 1);
      const calculatedDepartureAt =
        startAt - (minutes + settings.travelBufferMinutes) * 60 * 1000;
      const leaveNow = calculatedDepartureAt <= now + 60_000;
      const departureAt = leaveNow ? now + 10_000 : calculatedDepartureAt;

      adaptations.set(getPersistentGroupId(event), {
        scheduledAt: departureAt,
        title: leaveNow
          ? `지금부터 ${placeName}(으)로 이동해야 늦지 않습니다`
          : `${placeName}까지 약 ${minutes}분 소요됩니다`,
        body: leaveNow
          ? `현재 위치 기준 약 ${minutes}분 거리입니다. 바로 출발해 주세요.`
          : `${formatDepartureTime(new Date(departureAt))}에 출발하면 ${scheduleTitle} 일정에 맞출 수 있습니다.`,
        estimate,
      });
    })
  );

  if (adaptations.size === 0) return events;

  return events.map((event) => {
    if (event.eventType !== "travel_start") return event;
    const adaptation = adaptations.get(getPersistentGroupId(event));
    if (!adaptation) return event;

    const repeatIndex = getRepeatIndex(event);
    const scheduledAt =
      adaptation.scheduledAt +
      repeatIndex * getIntervalMinutes(event) * 60 * 1000;

    return {
      ...event,
      scheduledAt: new Date(scheduledAt).toISOString(),
      title:
        repeatIndex === 0
          ? adaptation.title
          : `${adaptation.title} · 확인 필요 (${repeatIndex + 1})`,
      body: adaptation.body,
      payload: {
        ...(event.payload ?? {}),
        adaptiveTravelAlarm: true,
        travelMinutes: adaptation.estimate.minutes ?? 0,
        distanceMeters: adaptation.estimate.distanceMeters ?? null,
        atDestination: adaptation.estimate.atDestination === true,
        travelProvider: adaptation.estimate.provider ?? "unknown",
        locationCalculatedAt: new Date().toISOString(),
      },
    };
  });
}
