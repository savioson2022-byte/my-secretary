import { STORAGE_KEYS, STORAGE_TO_SUPABASE_TABLE } from "@/lib/storageKeys";

export type StorageDomain =
  | "assistant-items"
  | "routine-schedules"
  | "single-schedules"
  | "places"
  | "purchase-history"
  | "personal-ai-memory"
  | "suggestion-feedback"
  | "travel-time-rules"
  | "travel-time-estimates"
  | "user-profile"
  | "voice-settings";

export type StorageMigrationPriority = "first" | "early" | "middle" | "late";

export type StorageCatalogItem = {
  domain: StorageDomain;
  label: string;
  localStorageKey: string;
  supabaseTable: string | null;
  priority: StorageMigrationPriority;
  userScoped: boolean;
  note: string;
};

export const STORAGE_CATALOG: StorageCatalogItem[] = [
  {
    domain: "user-profile",
    label: "사용자 프로필과 AI 분류 기준",
    localStorageKey: STORAGE_KEYS.userProfile,
    supabaseTable: STORAGE_TO_SUPABASE_TABLE[STORAGE_KEYS.userProfile],
    priority: "first",
    userScoped: true,
    note: "로그인 사용자의 이름, 분류 기준, 주 이동수단을 저장한다.",
  },
  {
    domain: "places",
    label: "저장 장소",
    localStorageKey: STORAGE_KEYS.savedPlaces,
    supabaseTable: STORAGE_TO_SUPABASE_TABLE[STORAGE_KEYS.savedPlaces],
    priority: "early",
    userScoped: true,
    note: "이동시간 계산의 기준이 되므로 일정 저장소보다 먼저 DB 전환한다.",
  },
  {
    domain: "routine-schedules",
    label: "정기 일정",
    localStorageKey: STORAGE_KEYS.routineSchedules,
    supabaseTable: STORAGE_TO_SUPABASE_TABLE[STORAGE_KEYS.routineSchedules],
    priority: "middle",
    userScoped: true,
    note: "주간/월간 캘린더와 빈 시간 계산의 기본 데이터다.",
  },
  {
    domain: "single-schedules",
    label: "단기 일정",
    localStorageKey: STORAGE_KEYS.singleSchedules,
    supabaseTable: STORAGE_TO_SUPABASE_TABLE[STORAGE_KEYS.singleSchedules],
    priority: "middle",
    userScoped: true,
    note: "AI 분류 결과에서 날짜와 시간이 있는 항목이 자동 등록된다.",
  },
  {
    domain: "assistant-items",
    label: "저장된 기록",
    localStorageKey: STORAGE_KEYS.assistantItems,
    supabaseTable: STORAGE_TO_SUPABASE_TABLE[STORAGE_KEYS.assistantItems],
    priority: "middle",
    userScoped: true,
    note: "할 일, 일정, 아이디어, 기타 기록 원본이다.",
  },
  {
    domain: "purchase-history",
    label: "구매 이력과 재구매 자동화 설정",
    localStorageKey: STORAGE_KEYS.purchaseHistory,
    supabaseTable: STORAGE_TO_SUPABASE_TABLE[STORAGE_KEYS.purchaseHistory],
    priority: "middle",
    userScoped: true,
    note: "이미 구매한 상품만 재구매 자동화 후보로 허용하기 위한 사용자별 안전 장치다.",
  },
  {
    domain: "personal-ai-memory",
    label: "개인 AI 메모리",
    localStorageKey: STORAGE_KEYS.personalAiMemory,
    supabaseTable: STORAGE_TO_SUPABASE_TABLE[STORAGE_KEYS.personalAiMemory],
    priority: "middle",
    userScoped: true,
    note: "온디바이스 Gemma와 서버 AI가 공통으로 읽는 사용자별 분류, 추천, 구매, 알림 기준이다.",
  },
  {
    domain: "suggestion-feedback",
    label: "추천 피드백",
    localStorageKey: STORAGE_KEYS.suggestionFeedback,
    supabaseTable: STORAGE_TO_SUPABASE_TABLE[STORAGE_KEYS.suggestionFeedback],
    priority: "middle",
    userScoped: true,
    note: "추천 시간이 맞았는지, 장소가 맞았는지의 사용자 피드백을 저장한다.",
  },
  {
    domain: "travel-time-rules",
    label: "이동시간 수동 규칙",
    localStorageKey: STORAGE_KEYS.travelTimeRules,
    supabaseTable: STORAGE_TO_SUPABASE_TABLE[STORAGE_KEYS.travelTimeRules],
    priority: "late",
    userScoped: true,
    note: "외부 API가 없거나 예외 경로가 있을 때의 수동 보정값이다.",
  },
  {
    domain: "travel-time-estimates",
    label: "이동시간 API 캐시",
    localStorageKey: STORAGE_KEYS.travelTimeEstimates,
    supabaseTable: STORAGE_TO_SUPABASE_TABLE[STORAGE_KEYS.travelTimeEstimates],
    priority: "late",
    userScoped: true,
    note: "같은 출발지, 출발시각, 도착지, 이동수단 조합의 API 결과를 재사용한다.",
  },
  {
    domain: "voice-settings",
    label: "음성 입력 방식",
    localStorageKey: STORAGE_KEYS.voiceControlMode,
    supabaseTable: null,
    priority: "late",
    userScoped: false,
    note: "기기마다 선호가 다를 수 있어 사용자 설정 또는 기기 설정으로 분리한다.",
  },
];

export function getStorageCatalogByPriority(priority: StorageMigrationPriority) {
  return STORAGE_CATALOG.filter((item) => item.priority === priority);
}
