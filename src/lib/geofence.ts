import { Capacitor, registerPlugin } from "@capacitor/core";
import { recordContextEvent } from "@/lib/contextEventStorage";
import { getSavedPlaces } from "@/lib/placeStorage";

/**
 * 저장한 장소의 도착·이탈을 OS가 알려주게 한다.
 *
 * adaptiveTravelNotifications의 30분 폴링과 달리 앱이 꺼져 있어도 깨어난다.
 * 지원하지 않는 환경에서는 조용히 아무것도 하지 않는다.
 */

const PLUGIN_NAME = "Geofence";

export type GeofenceAuthorizationState =
  | "notDetermined"
  | "denied"
  | "restricted"
  | "whenInUse"
  | "always";

export type GeofenceStatus = {
  available: boolean;
  authorizationState: GeofenceAuthorizationState;
  monitoredCount: number;
  maxRegions: number;
};

type GeofencePlugin = {
  getStatus(): Promise<GeofenceStatus>;
  requestAlwaysAccess(): Promise<GeofenceStatus>;
  replaceRegions(options: {
    places: { id: string; latitude: number; longitude: number; radius?: number }[];
  }): Promise<{ monitoredCount: number; reason?: string }>;
  clearRegions(): Promise<{ monitoredCount: number }>;
  addListener(
    eventName: "placeArrived" | "placeLeft",
    listener: (event: { placeId: string; occurredAt: string }) => void
  ): Promise<{ remove: () => Promise<void> }>;
};

const Geofence = registerPlugin<GeofencePlugin>(PLUGIN_NAME);

const UNAVAILABLE: GeofenceStatus = {
  available: false,
  authorizationState: "denied",
  monitoredCount: 0,
  maxRegions: 0,
};

function isSupported() {
  return (
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === "ios" &&
    Capacitor.isPluginAvailable(PLUGIN_NAME)
  );
}

export async function getGeofenceStatus(): Promise<GeofenceStatus> {
  if (!isSupported()) return UNAVAILABLE;

  try {
    return await Geofence.getStatus();
  } catch {
    return UNAVAILABLE;
  }
}

export async function requestGeofenceAccess(): Promise<GeofenceStatus> {
  if (!isSupported()) return UNAVAILABLE;

  try {
    return await Geofence.requestAlwaysAccess();
  } catch {
    return UNAVAILABLE;
  }
}

/** 저장 장소 중 좌표가 있는 곳을 감시 대상으로 올린다. */
export async function syncGeofenceRegions(): Promise<number> {
  if (!isSupported()) return 0;

  const places = getSavedPlaces()
    .filter(
      (place) =>
        typeof place.latitude === "number" && typeof place.longitude === "number"
    )
    .map((place) => ({
      id: place.id,
      latitude: place.latitude as number,
      longitude: place.longitude as number,
    }));

  if (places.length === 0) {
    try {
      await Geofence.clearRegions();
    } catch {
      // 무시
    }
    return 0;
  }

  try {
    const { monitoredCount } = await Geofence.replaceRegions({ places });
    return monitoredCount;
  } catch {
    return 0;
  }
}

/** 도착·이탈을 맥락 기록으로 남긴다. 반환값을 부르면 구독을 해제한다. */
export function listenToGeofenceEvents(onChange?: () => void): () => void {
  if (!isSupported()) return () => {};

  const removers: (() => Promise<void>)[] = [];
  let cancelled = false;

  function handle(type: "place_arrived" | "place_left") {
    return (event: { placeId: string; occurredAt: string }) => {
      const place = getSavedPlaces().find((item) => item.id === event.placeId);

      const recorded = recordContextEvent({
        type,
        placeId: event.placeId,
        placeName: place?.name ?? null,
        occurredAt: event.occurredAt,
      });

      if (recorded) onChange?.();
    };
  }

  void Geofence.addListener("placeArrived", handle("place_arrived"))
    .then((handleRef) => {
      if (cancelled) return void handleRef.remove();
      removers.push(handleRef.remove);
    })
    .catch(() => {});

  void Geofence.addListener("placeLeft", handle("place_left"))
    .then((handleRef) => {
      if (cancelled) return void handleRef.remove();
      removers.push(handleRef.remove);
    })
    .catch(() => {});

  return () => {
    cancelled = true;
    removers.forEach((remove) => void remove());
  };
}
