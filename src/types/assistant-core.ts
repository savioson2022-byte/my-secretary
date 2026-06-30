/* 앱의 기본 뼈대*/
export type DayOfWeek = "월" | "화" | "수" | "목" | "금" | "토" | "일";

export type MainItemType =
  | "정기시간표"
  | "단기일정"
  | "즉시처리"
  | "시간작업"
  | "메모"
  | "아이디어";

export type Category =
  | "학업"
  | "업무"
  | "생활/구매"
  | "건강"
  | "관계"
  | "자기계발"
  | "기타";

export type ActionType =
  | "구매"
  | "예약"
  | "연락"
  | "제출"
  | "확인"
  | "공부"
  | "조사"
  | "정리"
  | "운동"
  | "기록"
  | "기타";

export type Priority = "낮음" | "보통" | "높음";

export type Status = "미완료" | "완료" | "보류";

export type EnergyLevel = "낮음" | "보통" | "높음";

export type TimePreference =
  | "아침"
  | "오전"
  | "점심"
  | "오후"
  | "저녁"
  | "밤"
  | "상관없음";

export type EnvironmentCondition = {
  needsDesk?: boolean;
  needsComputer?: boolean;
  needsPhone?: boolean;
  needsQuietPlace?: boolean;
  needsShowerAfter?: boolean;
  canDoWhileMoving?: boolean;
};

export type Place = {
  id: string;
  name: string;
  address?: string;
  memo?: string;
  createdAt: string;
  updatedAt: string;
};

export type RoutineSchedule = {
  id: string;
  title: string;
  dayOfWeek: DayOfWeek;
  startTime: string; // "08:30"
  endTime: string; // "16:50"
  placeId: string;
  placeName: string;
  memo?: string;
  createdAt: string;
  updatedAt: string;
};

export type ShortTermSchedule = {
  id: string;
  title: string;
  date: string; // "2026-06-25"
  startTime: string; // "15:00"
  endTime: string; // "16:00"
  placeId?: string;
  placeName?: string;
  memo?: string;
  createdAt: string;
  updatedAt: string;
};

export type TravelTimeRule = {
  id: string;
  fromPlaceId: string;
  fromPlaceName: string;
  toPlaceId: string;
  toPlaceName: string;
  minutes: number;
  createdAt: string;
  updatedAt: string;
};

export type AssistantTask = {
  id: string;
  originalText: string;
  title: string;

  mainType: Exclude<MainItemType, "정기시간표" | "단기일정">;

  category: Category;
  actionType: ActionType;

  estimatedMinutes: number | null;
  dueDate: string | null;
  preferredDate: string | null;
  preferredTime: TimePreference;

  priority: Priority;
  status: Status;

  energyRequired: EnergyLevel;
  environment: EnvironmentCondition;

  canSplit: boolean;
  minBlockMinutes: number | null;

  createdAt: string;
  updatedAt: string;
};

export type ClassifiedInput =
  | {
      kind: "정기시간표";
      routine: Omit<RoutineSchedule, "id" | "createdAt" | "updatedAt">;
    }
  | {
      kind: "단기일정";
      schedule: Omit<ShortTermSchedule, "id" | "createdAt" | "updatedAt">;
    }
  | {
      kind: "작업";
      task: Omit<AssistantTask, "id" | "createdAt" | "updatedAt" | "status">;
    };