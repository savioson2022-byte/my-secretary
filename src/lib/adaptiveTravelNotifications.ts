"use client";

import type {
  NotificationEvent,
  NotificationSettings,
} from "@/types/notification";
import type { TravelMode } from "@/types/calendar";
import { getSavedPlaces } from "@/lib/placeStorage";
import { findTravelModePreference } from "@/lib/travelTimeStorage";

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

const POSITION_CACHE_MS = 30 * 60 * 1000;
const LOCATION_MONITOR_WINDOW_MINUTES = 180;
const ACTION_THRESHOLD_MINUTES = 30;
const NEARBY_WALK_MAX_METERS = 1_200;
const SAVED_PLACE_MATCH_MAX_METERS = 500;
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

function getTravelModeLabel(mode: TravelMode) {
  if (mode === "walk") return "도보";
  if (mode === "car") return "자차";
  return "대중교통";
}

function getDistanceMeters(from: CurrentCoordinates, to: CurrentCoordinates) {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const startLatitude = toRadians(from.latitude);
  const endLatitude = toRadians(to.latitude);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return (
    earthRadiusMeters *
    2 *
    Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
  );
}

function findCurrentSavedPlace(current: CurrentCoordinates) {
  return getSavedPlaces()
    .map((place) => ({
      place,
      distance:
        Number.isFinite(place.latitude) && Number.isFinite(place.longitude)
          ? getDistanceMeters(current, {
              latitude: Number(place.latitude),
              longitude: Number(place.longitude),
            })
          : Number.POSITIVE_INFINITY,
    }))
    .filter((item) => item.distance <= SAVED_PLACE_MATCH_MAX_METERS)
    .sort((left, right) => left.distance - right.distance)[0]?.place;
}

function chooseTravelMode({
  current,
  event,
  settings,
  currentPlaceName,
}: {
  current: CurrentCoordinates;
  event: NotificationEvent;
  settings: NotificationSettings;
  currentPlaceName?: string;
}) {
  const learnedRule = currentPlaceName
    ? findTravelModePreference({
        fromPlaceName: currentPlaceName,
        toPlaceName: event.placeName,
      })
    : null;
  if (learnedRule) {
    return { mode: learnedRule.mode, source: "user-route-feedback" };
  }

  const directDistance = getDistanceMeters(current, {
    latitude: Number(event.latitude),
    longitude: Number(event.longitude),
  });
  if (directDistance <= NEARBY_WALK_MAX_METERS) {
    return { mode: "walk" as const, source: "nearby-walk-assumption" };
  }

  return {
    mode: (event.payload?.travelMode ??
      settings.preferredTravelMode) as TravelMode,
    source: event.payload?.travelMode ? "schedule-setting" : "user-default",
  };
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
  const checkWindowMs = LOCATION_MONITOR_WINDOW_MINUTES * 60 * 1000;
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
  const currentSavedPlace = findCurrentSavedPlace(current);

  const adaptations = new Map<
    string,
    {
      scheduledAt: number;
      title: string;
      body: string;
      estimate: TravelEstimate;
      mode: TravelMode;
      modeSource: string;
      fromPlaceName: string | null;
      remainingMinutes: number;
      slackMinutes: number;
    }
  >();

  await Promise.all(
    baseTravelEvents.slice(0, 6).map(async (event) => {
      const selection = chooseTravelMode({
        current,
        event,
        settings,
        currentPlaceName: currentSavedPlace?.name,
      });
      const mode = selection.mode;
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
      const remainingMinutes = Math.max(
        0,
        Math.ceil((startAt - now) / 60_000)
      );
      const minutes = estimate.atDestination
        ? 0
        : Math.max(1, estimate.minutes ?? 1);
      const slackMinutes = remainingMinutes - minutes;
      const decisionAt =
        startAt - (minutes + ACTION_THRESHOLD_MINUTES) * 60 * 1000;
      const alertNow = decisionAt <= now + 60_000;
      const scheduledAt = alertNow ? now + 10_000 : decisionAt;

      if (estimate.atDestination) {
        adaptations.set(getPersistentGroupId(event), {
          scheduledAt,
          title: `현 위치는 ${placeName}입니다`,
          body: alertNow
            ? `${scheduleTitle} 일정까지 ${remainingMinutes}분 남았습니다. 시작 준비를 확인해 주세요.`
            : `${scheduleTitle} 일정 30분 전에 시작 준비를 알려드릴게요.`,
          estimate,
          mode,
          modeSource: selection.source,
          fromPlaceName: currentSavedPlace?.name ?? null,
          remainingMinutes,
          slackMinutes,
        });
        return;
      }

      const modeLabel = getTravelModeLabel(mode);

      adaptations.set(getPersistentGroupId(event), {
        scheduledAt,
        title: alertNow
          ? `지금부터 ${placeName}(으)로 이동해야 늦지 않습니다`
          : `${placeName}까지 ${modeLabel}로 약 ${minutes}분 소요됩니다`,
        body: alertNow
          ? `일정까지 ${remainingMinutes}분, 이동은 약 ${minutes}분입니다. 남은 여유가 ${Math.max(0, slackMinutes)}분이므로 바로 출발해 주세요.`
          : `${formatDepartureTime(new Date(scheduledAt))}에 남은 여유가 30분이 됩니다. 그때 출발 판단 알람을 보낼게요.`,
        estimate,
        mode,
        modeSource: selection.source,
        fromPlaceName: currentSavedPlace?.name ?? null,
        remainingMinutes,
        slackMinutes,
      });
    })
  );

  if (adaptations.size === 0) return events;

  const adaptedScheduleKeys = new Set(
    baseTravelEvents
      .filter((event) => adaptations.has(getPersistentGroupId(event)))
      .map(
        (event) =>
          `${event.sourceType}:${event.sourceId}:${event.occurrenceDate}`
      )
  );

  return events
    .filter((event) => {
      if (event.eventType !== "prep_start") return true;
      const scheduleKey = `${event.sourceType}:${event.sourceId}:${event.occurrenceDate}`;
      return !adaptedScheduleKeys.has(scheduleKey);
    })
    .map((event) => {
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
        selectedTravelMode: adaptation.mode,
        travelModeSource: adaptation.modeSource,
        currentSavedPlaceName: adaptation.fromPlaceName,
        locationMonitorWindowMinutes: LOCATION_MONITOR_WINDOW_MINUTES,
        locationSampleIntervalMinutes: POSITION_CACHE_MS / 60_000,
        actionThresholdMinutes: ACTION_THRESHOLD_MINUTES,
        remainingMinutesAtCalculation: adaptation.remainingMinutes,
        slackMinutesAtCalculation: adaptation.slackMinutes,
        locationCalculatedAt: new Date().toISOString(),
      },
    };
    });
}
