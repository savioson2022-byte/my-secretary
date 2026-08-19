/**
 * 사용자가 입력하지 않아도 앱이 알게 되는 사실들.
 *
 * 지금까지 앱은 사용자가 말해준 것만 알았다. 여기서부터는 관찰한다.
 * 종류를 하나의 얇은 스키마로 통일해서, 감지 경로가 늘어도 판단 쪽은
 * 바꾸지 않아도 되게 한다.
 */

export type ContextEventType =
  /** 저장한 장소에 도착 */
  | "place_arrived"
  /** 저장한 장소에서 벗어남 */
  | "place_left"
  /** 앱을 열었다 */
  | "app_opened";

export type ContextEvent = {
  id: string;
  type: ContextEventType;
  /** 장소 이벤트면 SavedPlace의 id */
  placeId: string | null;
  placeName: string | null;
  /** 발생 시각 */
  occurredAt: string;
  createdAt: string;
};

export const CONTEXT_EVENT_LABEL: Record<ContextEventType, string> = {
  place_arrived: "도착",
  place_left: "출발",
  app_opened: "앱 열림",
};
