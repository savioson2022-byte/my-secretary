export type DayOfWeek = "월" | "화" | "수" | "목" | "금" | "토" | "일";

export type RoutineSchedule = {
  id: string;
  title: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  placeName: string;
  memo: string;

  // 월간/주간 캘린더에서 표시할 사용자 지정 색상
  color?: string;

  // 정기 시간표가 시작되는 날짜
  // 예: "2026-03-02"
  // 기간 제한이 없으면 null
  startDate: string | null;

  // 정기 시간표가 끝나는 날짜
  // 예: "2026-06-05"
  // 계속 반복이면 null
  endDate: string | null;

  // 현재 시간표에서 사용할지 여부
  // 나중에 종료일이 지나면 false처럼 다룰 수 있음
  isActive: boolean;

  createdAt: string;
  updatedAt: string;
};
