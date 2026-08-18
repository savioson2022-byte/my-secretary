import { getScopedStorageKey } from "@/lib/authScopedStorage";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import type { ExternalCalendarSource } from "@/types/externalCalendar";

/**
 * 어떤 시스템 캘린더를 빈 시간 계산에 넣을지에 대한 사용자 선택.
 *
 * 캘린더별로 명시적으로 켜거나 끈 것만 저장하고, 아직 판단하지 않은 캘린더는
 * 기본 규칙을 따른다(구독 캘린더는 꺼짐, 내 캘린더는 켜짐).
 * 새 캘린더가 나중에 추가돼도 사용자가 다시 설정할 필요가 없다.
 */

export const EXTERNAL_CALENDAR_SETTINGS_CHANGED_EVENT =
  "my-assistant-external-calendar-settings-changed";

export type ExternalCalendarSettings = {
  /** 연동 자체를 켰는지. 기본값은 꺼짐이며 사용자가 직접 켠다. */
  enabled: boolean;
  /** 명시적으로 켠 캘린더 id */
  includedCalendarIds: string[];
  /** 명시적으로 끈 캘린더 id */
  excludedCalendarIds: string[];
  updatedAt: string;
};

export const DEFAULT_EXTERNAL_CALENDAR_SETTINGS: ExternalCalendarSettings = {
  enabled: false,
  includedCalendarIds: [],
  excludedCalendarIds: [],
  updatedAt: new Date(0).toISOString(),
};

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function getExternalCalendarSettings(): ExternalCalendarSettings {
  if (typeof window === "undefined") {
    return DEFAULT_EXTERNAL_CALENDAR_SETTINGS;
  }

  const rawValue = window.localStorage.getItem(
    getScopedStorageKey(STORAGE_KEYS.externalCalendarSettings)
  );

  if (!rawValue) return DEFAULT_EXTERNAL_CALENDAR_SETTINGS;

  try {
    const parsed = JSON.parse(rawValue) as Partial<ExternalCalendarSettings>;

    return {
      enabled: parsed.enabled === true,
      includedCalendarIds: readStringArray(parsed.includedCalendarIds),
      excludedCalendarIds: readStringArray(parsed.excludedCalendarIds),
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : DEFAULT_EXTERNAL_CALENDAR_SETTINGS.updatedAt,
    };
  } catch {
    return DEFAULT_EXTERNAL_CALENDAR_SETTINGS;
  }
}

export function saveExternalCalendarSettings(
  settings: Omit<ExternalCalendarSettings, "updatedAt">
): ExternalCalendarSettings {
  const nextSettings: ExternalCalendarSettings = {
    ...settings,
    updatedAt: new Date().toISOString(),
  };

  if (typeof window === "undefined") return nextSettings;

  window.localStorage.setItem(
    getScopedStorageKey(STORAGE_KEYS.externalCalendarSettings),
    JSON.stringify(nextSettings)
  );
  window.dispatchEvent(new Event(EXTERNAL_CALENDAR_SETTINGS_CHANGED_EVENT));

  return nextSettings;
}

/**
 * 규칙 5: 공휴일, 스포츠 일정처럼 구독으로 들어온 캘린더는 기본으로 끈다.
 * 이걸 바쁜 시간으로 잡으면 그 날 빈 시간이 사라진다.
 */
export function isCalendarSourceEnabled(
  source: ExternalCalendarSource,
  settings: ExternalCalendarSettings
): boolean {
  if (settings.excludedCalendarIds.includes(source.id)) return false;
  if (settings.includedCalendarIds.includes(source.id)) return true;

  return !source.isSubscribed;
}

/** 조회에 넘길 캘린더 id 목록. 비어 있으면 읽을 캘린더가 없다는 뜻이다. */
export function getEnabledCalendarIds(
  sources: ExternalCalendarSource[],
  settings: ExternalCalendarSettings
): string[] {
  return sources
    .filter((source) => isCalendarSourceEnabled(source, settings))
    .map((source) => source.id);
}

export function toggleCalendarSource(
  settings: ExternalCalendarSettings,
  source: ExternalCalendarSource,
  nextEnabled: boolean
): Omit<ExternalCalendarSettings, "updatedAt"> {
  const includedCalendarIds = settings.includedCalendarIds.filter(
    (id) => id !== source.id
  );
  const excludedCalendarIds = settings.excludedCalendarIds.filter(
    (id) => id !== source.id
  );

  if (nextEnabled) {
    includedCalendarIds.push(source.id);
  } else {
    excludedCalendarIds.push(source.id);
  }

  return {
    enabled: settings.enabled,
    includedCalendarIds,
    excludedCalendarIds,
  };
}
