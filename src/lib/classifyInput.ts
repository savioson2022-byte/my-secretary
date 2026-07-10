import { AssistantItemWithoutId } from "@/types/assistant";

function getDateAfterDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function detectDate(text: string) {
  if (/오늘/.test(text)) return getDateAfterDays(0);
  if (/내일/.test(text)) return getDateAfterDays(1);
  if (/모레/.test(text)) return getDateAfterDays(2);

  return null;
}

function detectCategory(text: string): AssistantItemWithoutId["category"] {
  /**
   * 중요:
   * 구매를 건강보다 먼저 판단해야 함.
   * "염색약" 안에 "약"이 들어 있어서 건강으로 잘못 분류되는 문제를 막기 위함.
   */
  if (/(구매|주문|쿠팡|편의점|사야|시켜|장보기|배송|결제|물건|염색약)/.test(text)) {
    return "생활/구매";
  }

  if (/(공부|시험|수행|과제|학교|학원|수업|미적분|대수|기하|영어|물리|지구과학|문학|현윤|인공지능|복습|예습|문제)/.test(text)) {
    return "학업";
  }

  if (/(운동|헬스|산책|스트레칭|병원|건강|수면|통증|아픔|아파|약 먹|약국)/.test(text)) {
    return "건강";
  }

  if (/(친구|데이트|약속|카톡|전화|연락|만나|여친|남친)/.test(text)) {
    return "연애 및 친목";
  }

  if (/(코딩|개발|독서|습관|프로젝트|자기계발|앱|비서)/.test(text)) {
    return "자기계발";
  }

  if (/(회의|업무|일처리|문서|보고|회사)/.test(text)) {
    return "업무";
  }

  return "기타";
}

function detectActionType(text: string): AssistantItemWithoutId["actionType"] {
  if (/(구매|주문|사야|시켜|쿠팡|결제|장보기|염색약)/.test(text)) {
    return "구매";
  }

  if (/(예약|예매|신청)/.test(text)) {
    return "예약";
  }

  if (/(연락|전화|카톡|문자|DM|말하기)/.test(text)) {
    return "연락";
  }

  if (/(공부|복습|예습|문제|수업 준비|시험 준비|풀기|외우기)/.test(text)) {
    return "공부";
  }

  if (/(조사|검색|찾아|알아봐|자료)/.test(text)) {
    return "검색/조사";
  }

  if (/(정리|청소|치우기)/.test(text)) {
    return "정리";
  }

  if (/(운동|헬스|산책|스트레칭)/.test(text)) {
    return "운동";
  }

  if (/(아이디어|하면 좋겠다|만들고 싶다|추가하면|기능 넣기)/.test(text)) {
    return "아이디어";
  }

  if (/(기억|메모|알게 됨|선생님이|라고 함|참고)/.test(text)) {
    return "메모";
  }

  return "기타";
}

function detectPriority(text: string): AssistantItemWithoutId["priority"] {
  if (/(오늘|내일|급함|급해|중요|마감|시험|제출|까먹으면 안)/.test(text)) {
    return "높음";
  }

  if (/(나중에|언젠가|시간 나면|해볼까)/.test(text)) {
    return "낮음";
  }

  return "보통";
}

function detectRepeatType(text: string): AssistantItemWithoutId["repeatType"] {
  if (/(매일|매주|매달|월마다|주마다|반복|꾸준히|정기적으로)/.test(text)) {
    return "주기성";
  }

  return "일회성";
}

function detectProcessType(
  text: string,
  actionType: AssistantItemWithoutId["actionType"]
): AssistantItemWithoutId["processType"] {
  // 반복되는 고정 일정
  if (
    /(매일|매주|매달|월마다|주마다|반복|꾸준히|정기적으로|월요일마다|화요일마다|수요일마다|목요일마다|금요일마다|토요일마다|일요일마다)/.test(
      text
    )
  ) {
    return "메모";
  }

  // 날짜/시간이 있는 확정 일정
  if (
    /(오늘|내일|모레|\d{1,2}월|\d{1,2}\/\d{1,2}).*(시|예약|약속|시험|일정|수업|병원|미용실)/.test(
      text
    )
  ) {
    return "단기일정";
  }

  // 5분 안에 끝나는 일
  if (
    actionType === "구매" ||
    actionType === "예약" ||
    actionType === "연락"
  ) {
    return "즉시처리";
  }

  // 생각 저장
  if (actionType === "아이디어") {
    return "메모";
  }

  // 정보 저장
  if (actionType === "메모") {
    return "메모";
  }

  // 시간이 필요한 작업
  if (
    actionType === "공부" ||
    actionType === "검색/조사" ||
    actionType === "정리" ||
    actionType === "운동"
  ) {
    return "메모";
  }

  return "메모";
}

function detectPurchaseProductName(text: string) {
  const cleanedText = text
    .replace(/쿠팡에서|쿠팡|로켓배송|주문해줘|주문|구매해줘|구매|결제|사줘|사야|시켜줘|시켜|좀|해줘|필요해|떨어졌어|다 떨어졌어/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleanedText || null;
}

function detectEstimatedMinutes(
  actionType: AssistantItemWithoutId["actionType"]
): number | null {
  if (actionType === "구매") return 5;
  if (actionType === "예약") return 5;
  if (actionType === "연락") return 5;

  if (actionType === "공부") return 60;
  if (actionType === "검색/조사") return 40;
  if (actionType === "정리") return 30;
  if (actionType === "운동") return 45;

  return null;
}

export function classifyInput(originalText: string): AssistantItemWithoutId {
  const text = originalText.trim();

  const category = detectCategory(text);
  const actionType = detectActionType(text);
  const priority = detectPriority(text);
  const repeatType = detectRepeatType(text);
  const detectedDate = detectDate(text);
  const processType = detectProcessType(text, actionType);
  const estimatedMinutes = detectEstimatedMinutes(actionType);
  const purchaseProductName =
    actionType === "구매" ? detectPurchaseProductName(text) : null;

  const title = text.length > 22 ? `${text.slice(0, 22)}...` : text;

  return {
    originalText: text,
    title,
    repeatType,
    category,
    actionType,
    priority,
    dueDate: detectedDate,
    reminderDate: detectedDate,
    status: "미완료",
    processType,
    estimatedMinutes,
    purchaseProductName,
    purchasePlatform: actionType === "구매" ? "coupang" : null,
  };
}
