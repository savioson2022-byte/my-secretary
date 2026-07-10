export type Category =
  | "업무"
  | "학업"
  | "연애 및 친목"
  | "건강"
  | "자기계발"
  | "생활/구매"
  | "기타";

export type ActionType =
  | "구매"
  | "검색/조사"
  | "연락"
  | "예약"
  | "공부"
  | "운동"
  | "정리"
  | "아이디어"
  | "메모"
  | "기타";

export type ProcessType =
  | "즉시처리"
  | "에이전트위임"
  | "시간작업"
  | "단기일정"
  | "정기시간표"
  | "메모"
  | "아이디어";

export type Priority = "낮음" | "보통" | "높음";

export type RepeatType = "일회성" | "주기성";

export type ItemStatus = "미완료" | "완료" | "보류";

export type FilterType = "전체" | ItemStatus | Category;

export type AssistantItemWithoutId = {
  originalText: string;
  title: string;

  category: Category;
  actionType: ActionType;
  processType: ProcessType;

  priority: Priority;
  repeatType: RepeatType;
  status: ItemStatus;

  estimatedMinutes: number | null;

  /**
   * 시간작업의 마감일 또는 단기일정의 날짜
   * 예: "2026-06-25"
   */
  dueDate: string | null;

  /**
   * 다시 확인해야 하는 알림 날짜
   * 예: "2026-06-24"
   */
  reminderDate: string | null;

  /**
   * 단기일정일 때 캘린더에 들어갈 시작 시간
   * 예: "15:00"
   */
  scheduleStartTime?: string | null;

  /**
   * 단기일정일 때 캘린더에 들어갈 종료 시간
   * 예: "16:00"
   */
  scheduleEndTime?: string | null;

  /**
   * 기록 저장 시 단기 일정으로 등록될 경우 캘린더에 표시할 색상
   */
  color?: string;
  ideaGroupId?: string | null;
  ideaGroupTitle?: string | null;
  ideaSubcategory?: string | null;
  purchaseProductName?: string | null;
  purchasePlatform?: "coupang" | "other" | null;
};

export type AssistantItem = AssistantItemWithoutId & {
  id: string;
  createdAt: string;
  updatedAt: string;
};
