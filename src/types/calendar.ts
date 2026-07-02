import { DayOfWeek } from "@/types/routine";

export type SingleSchedule = {
  id: string;

  title: string;

  /**
   * 한 번만 발생하는 날짜
   * 예: "2026-06-25"
   */
  date: string;

  /**
   * 시작 시간
   * 예: "15:00"
   */
  startTime: string;

  /**
   * 종료 시간
   * 예: "16:00"
   */
  endTime: string;

  /**
   * 위치
   * 단기 일정은 처음에는 말로 대충 입력될 수 있으므로
   * 나중에 사용자가 직접 추가하거나 수정할 수 있게 비워둘 수 있다.
   */
  placeName: string;

  /**
   * 메모
   */
  memo: string;

  /**
   * 사용자가 입력한 원래 기록 AssistantItem과 연결하기 위한 id
   * 아직 연결된 기록이 없으면 null
   */
  sourceItemId: string | null;

  createdAt: string;
  updatedAt: string;
};

export type CalendarBusyBlock = {
  id: string;
  title: string;

  /**
   * 정기 일정인지 단기 일정인지 구분
   */
  sourceType: "routine" | "single";

  /**
   * 단기 일정은 date가 있고,
   * 정기 일정은 dayOfWeek가 있다.
   */
  date: string | null;
  dayOfWeek: DayOfWeek | null;

  startTime: string;
  endTime: string;

  placeName: string;
};

export type TravelMode = "walk" | "transit" | "car";

export type SavedPlace = {
  id: string;
  name: string;
  address: string;
  postalCode?: string;
  memo: string;
  latitude?: number | null;
  longitude?: number | null;
  provider?: string | null;
  providerPlaceId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TravelTimeRule = {
  id: string;
  fromPlaceName: string;
  toPlaceName: string;
  mode: TravelMode;
  minutes: number;
  memo: string;
  createdAt: string;
  updatedAt: string;
};

export type TravelTimeEstimate = {
  id: string;
  fromPlaceName: string;
  toPlaceName: string;
  fromAddress: string;
  toAddress: string;
  departureTime: string;
  mode: TravelMode;
  minutes: number;
  provider: string;
  cacheKey: string;
  createdAt: string;
  updatedAt: string;
};
