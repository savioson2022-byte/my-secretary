import { getScopedStorageKey } from "@/lib/authScopedStorage";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import type { ContextEvent, ContextEventType } from "@/types/contextEvent";

/**
 * 관찰한 사실을 쌓아두는 곳.
 *
 * 최근 것만 의미가 있으므로 오래된 것은 버린다. 이 기록은 파생 데이터라서
 * 기기 사이에서 동기화하지 않는다. 기기 A에서의 도착이 기기 B의 판단을
 * 흔들면 안 된다.
 */

export const CONTEXT_EVENT_CHANGED_EVENT = "my-assistant-context-event-changed";

const RETENTION_HOURS = 48;
const MAX_EVENTS = 200;

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readAll(): ContextEvent[] {
  if (typeof window === "undefined") return [];

  const rawValue = window.localStorage.getItem(
    getScopedStorageKey(STORAGE_KEYS.contextEvents)
  );

  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? (parsed as ContextEvent[]) : [];
  } catch {
    return [];
  }
}

function writeAll(events: ContextEvent[]) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    getScopedStorageKey(STORAGE_KEYS.contextEvents),
    JSON.stringify(events)
  );
  window.dispatchEvent(new Event(CONTEXT_EVENT_CHANGED_EVENT));
}

export function getContextEvents(now = new Date()): ContextEvent[] {
  const cutoff = now.getTime() - RETENTION_HOURS * 60 * 60_000;

  return readAll()
    .filter((event) => new Date(event.occurredAt).getTime() >= cutoff)
    .sort(
      (left, right) =>
        new Date(right.occurredAt).getTime() -
        new Date(left.occurredAt).getTime()
    );
}

export function recordContextEvent({
  type,
  placeId = null,
  placeName = null,
  occurredAt = new Date().toISOString(),
}: {
  type: ContextEventType;
  placeId?: string | null;
  placeName?: string | null;
  occurredAt?: string;
}): ContextEvent | null {
  const existing = getContextEvents();

  // 같은 장소의 같은 이벤트가 10분 안에 또 들어오면 무시한다.
  // 지오펜스는 경계에서 여러 번 튈 수 있다.
  const recentDuplicate = existing.find((event) => {
    if (event.type !== type || event.placeId !== placeId) return false;

    const gap =
      new Date(occurredAt).getTime() - new Date(event.occurredAt).getTime();

    return Math.abs(gap) < 10 * 60_000;
  });

  if (recentDuplicate) return null;

  const event: ContextEvent = {
    id: createId(),
    type,
    placeId,
    placeName,
    occurredAt,
    createdAt: new Date().toISOString(),
  };

  writeAll([event, ...existing].slice(0, MAX_EVENTS));

  return event;
}

/** 지금 사용자가 있는 것으로 보이는 장소. 도착 뒤 출발이 없으면 그 장소다. */
export function getCurrentPlaceFromContext(now = new Date()): {
  placeId: string;
  placeName: string | null;
  arrivedAt: string;
} | null {
  for (const event of getContextEvents(now)) {
    if (event.type === "place_left") return null;

    if (event.type === "place_arrived" && event.placeId) {
      return {
        placeId: event.placeId,
        placeName: event.placeName,
        arrivedAt: event.occurredAt,
      };
    }
  }

  return null;
}
