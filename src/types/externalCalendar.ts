/**
 * iOS 캘린더, 안드로이드 캘린더, Google 캘린더처럼
 * 앱 밖에서 관리되는 일정을 읽어오기 위한 공통 타입.
 *
 * 설계 문서: docs/calendar-integration-plan.md
 */

export type ExternalCalendarAuthorizationState =
  | "notDetermined"
  | "denied"
  | "restricted"
  | "fullAccess"
  | "unavailable";

export type ExternalCalendarProvider =
  | "eventkit"
  | "android-provider"
  | "google-api"
  | "none";

export type ExternalCalendarUnavailableReason =
  /** 아직 구현하지 않은 플랫폼. 웹과 안드로이드는 1g 이후 지원한다. */
  | "platformNotSupported"
  /** 네이티브 앱이지만 플러그인이 없는 구버전 */
  | "appUpdateRequired"
  /** 플러그인 호출 자체가 실패함 */
  | "bridgeError";

export type ExternalCalendarStatus = {
  available: boolean;
  authorizationState: ExternalCalendarAuthorizationState;
  provider: ExternalCalendarProvider;
  canWrite: boolean;
  osVersion?: string;
  reason?: ExternalCalendarUnavailableReason;
};

export type ExternalCalendarSource = {
  /** EventKit calendarIdentifier / 안드로이드 _id / Google calendarId */
  id: string;
  title: string;
  colorHex: string | null;
  /** 공휴일, 스포츠 일정처럼 구독으로 들어온 캘린더. 기본적으로 끈다. */
  isSubscribed: boolean;
  allowsModify: boolean;
  /** 계정 이름. "iCloud", "Gmail", 회사 Exchange 등 */
  sourceName: string;
};

/** 시간을 점유하지 않는다고 판정한 이유. 규칙 번호는 설계 문서 4절과 대응한다. */
export type ExternalCalendarExclusionReason =
  /** 규칙 1: 내가 거절한 회의 */
  | "declined"
  /** 규칙 2: 한가함으로 표시된 일정 */
  | "free"
  /** 규칙 3: 종일 일정 */
  | "allDay"
  /** 취소된 일정 */
  | "canceled";

export const EXTERNAL_CALENDAR_EXCLUSION_LABEL: Record<
  ExternalCalendarExclusionReason,
  string
> = {
  declined: "거절한 회의",
  free: "한가함으로 표시",
  allDay: "종일 일정",
  canceled: "취소된 일정",
};

export type ExternalCalendarEvent = {
  /** 플랫폼이 준 고유 id. 반복 일정은 회차마다 다르다. */
  externalId: string;
  calendarId: string;
  title: string;
  /** "2026-08-19" */
  date: string;
  /** "14:00". 종일 일정은 "00:00" */
  startTime: string;
  /**
   * "15:30". 자정에 끝나는 구간은 "24:00"으로 온다.
   * 하나의 date 안에서 항상 endTime > startTime 이다.
   */
  endTime: string;
  isAllDay: boolean;
  /**
   * 이 일정이 실제로 시간을 점유하는지.
   * 거절한 회의, 한가함으로 표시된 일정, 종일 일정은 false다.
   * 빈 시간 계산에는 true인 것만 넣는다.
   */
  blocksTime: boolean;
  /**
   * blocksTime이 false인 이유. 어떤 판정 규칙이 걸렸는지 확인할 때 쓴다.
   * 시간을 점유하면 null이다.
   */
  exclusionReason: ExternalCalendarExclusionReason | null;
  placeName: string | null;
  /** 앱이 전용 캘린더에 쓴 일정. 외부 일정으로 다시 계산하면 중복된다. */
  createdByApp: boolean;
};

export const UNAVAILABLE_EXTERNAL_CALENDAR_STATUS: ExternalCalendarStatus = {
  available: false,
  authorizationState: "unavailable",
  provider: "none",
  canWrite: false,
  reason: "platformNotSupported",
};
