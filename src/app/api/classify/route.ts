import OpenAI from "openai";
import { NextResponse } from "next/server";
import { classifyInput } from "@/lib/classifyInput";
import { AssistantItemWithoutId } from "@/types/assistant";

const CLASSIFICATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    originalText: {
      type: "string",
    },
    title: {
      type: "string",
    },
    category: {
      type: "string",
      enum: [
        "업무",
        "학업",
        "연애 및 친목",
        "건강",
        "자기계발",
        "생활/구매",
        "기타",
      ],
    },
    actionType: {
      type: "string",
      enum: [
        "구매",
        "검색/조사",
        "연락",
        "예약",
        "공부",
        "운동",
        "정리",
        "아이디어",
        "메모",
        "기타",
      ],
    },
    processType: {
      type: "string",
      enum: [
        "즉시처리",
        "에이전트위임",
        "시간작업",
        "단기일정",
        "정기시간표",
        "메모",
        "아이디어",
      ],
    },
    priority: {
      type: "string",
      enum: ["낮음", "보통", "높음"],
    },
    repeatType: {
      type: "string",
      enum: ["일회성", "주기성"],
    },
    status: {
      type: "string",
      enum: ["미완료", "완료", "보류"],
    },
    estimatedMinutes: {
      type: ["number", "null"],
    },
    dueDate: {
      type: ["string", "null"],
      description: "YYYY-MM-DD 형식의 날짜 또는 null",
    },
    reminderDate: {
      type: ["string", "null"],
      description: "YYYY-MM-DD 형식의 날짜 또는 null",
    },
    scheduleStartTime: {
      type: ["string", "null"],
      description: "단기일정 시작 시간. HH:mm 형식 또는 null",
    },
    scheduleEndTime: {
      type: ["string", "null"],
      description: "단기일정 종료 시간. HH:mm 형식 또는 null",
    },
    purchaseProductName: {
      type: ["string", "null"],
      description: "구매 위임일 때 상품명. 예: 물티슈, 충전기",
    },
    purchasePlatform: {
      type: ["string", "null"],
      enum: ["coupang", "other", null],
      description: "구매 위임 플랫폼. 쿠팡 요청이면 coupang",
    },
  },
  required: [
    "originalText",
    "title",
    "category",
    "actionType",
    "processType",
    "priority",
    "repeatType",
    "status",
    "estimatedMinutes",
    "dueDate",
    "reminderDate",
    "scheduleStartTime",
    "scheduleEndTime",
    "purchaseProductName",
    "purchasePlatform",
  ],
};

function getTodayTextInKorea() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date());
}

function isValidTimeText(value: string | null | undefined) {
  if (!value) return false;

  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function timeToMinutes(time: string) {
  const [hourText, minuteText] = time.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  return hour * 60 + minute;
}

function minutesToTime(totalMinutes: number) {
  const safeMinutes = Math.max(0, Math.min(24 * 60, totalMinutes));
  const hour = Math.floor(safeMinutes / 60);
  const minute = safeMinutes % 60;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeResult(
  result: AssistantItemWithoutId,
  originalText: string
): AssistantItemWithoutId {
  const scheduleStartTime = isValidTimeText(result.scheduleStartTime)
    ? result.scheduleStartTime
    : null;

  let scheduleEndTime = isValidTimeText(result.scheduleEndTime)
    ? result.scheduleEndTime
    : null;

  if (
    result.processType === "단기일정" &&
    scheduleStartTime &&
    !scheduleEndTime
  ) {
    const duration = result.estimatedMinutes ?? 60;
    scheduleEndTime = minutesToTime(timeToMinutes(scheduleStartTime) + duration);
  }

  return {
    ...result,
    originalText,
    title: result.title || originalText,
    status: "미완료",
    estimatedMinutes:
      typeof result.estimatedMinutes === "number"
        ? result.estimatedMinutes
        : null,
    dueDate: result.dueDate || null,
    reminderDate: result.reminderDate || null,
    scheduleStartTime,
    scheduleEndTime,
    purchaseProductName:
      result.actionType === "구매" ? result.purchaseProductName ?? null : null,
    purchasePlatform:
      result.actionType === "구매" ? result.purchasePlatform ?? "coupang" : null,
  };
}

export async function POST(request: Request) {
  const body = await request.json();
  const text = String(body.text ?? "").trim();
  const userContext = String(body.userContext ?? "").trim().slice(0, 3000);

  if (!text) {
    return NextResponse.json(
      {
        error: "분류할 텍스트가 없습니다.",
      },
      {
        status: 400,
      }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    const fallbackResult = classifyInput(text);

    return NextResponse.json({
      result: fallbackResult,
      source: "fallback",
    });
  }

  try {
    const todayText = getTodayTextInKorea();
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: `
너는 개인 AI 비서 웹앱의 입력 분류기다.

현재 날짜는 한국 시간 기준 ${todayText} 이다.
사용자의 짧은 입력을 보고 반드시 정해진 JSON Schema에 맞춰 분류해라.
${userContext ? `\n사용자별 분류 기준:\n${userContext}\n` : ""}

분류 기준:

1. 즉시처리
- 5~10분 안에 끝낼 수 있는 행동
- 예: 엄마한테 연락하기, 간단한 확인하기
- estimatedMinutes는 보통 5 또는 10

2. 에이전트위임
- 외부 서비스에서 사용자를 대신해 준비하거나 실행해야 하는 요청
- 특히 "쿠팡에서 물티슈 사줘", "충전기 주문해줘", "로켓배송으로 시켜줘" 같은 구매 요청은 에이전트위임으로 분류해라.
- actionType은 "구매", category는 "생활/구매"로 둬라.
- purchaseProductName에는 실제 상품명을 짧게 넣어라. 예: "물티슈", "충전기", "고양이 사료"
- purchasePlatform은 쿠팡 요청이면 "coupang"으로 둬라.
- 단, 실제 결제는 사용자의 최종 확인이 필요하다.
- estimatedMinutes는 보통 5 또는 10

3. 시간작업
- 시간이 필요하지만 아직 시간이 확정된 일정은 아닌 작업
- 캘린더의 빈 시간에 배치 추천할 대상
- 예: 기하 문제 풀기, 미적분 수업 준비하기, 보고서 쓰기, 데이트 장소 찾아보기, 방 청소하기
- "머리 잘라야 하는데 언제 예약하지", "병원 갈 시간 잡아야 해"처럼 확정 시간은 없지만 사용자가 적절한 시간을 고르고 싶은 예약/방문/처리 대상도 시간작업으로 분류해라.
- 이런 예약형 시간작업은 actionType을 "예약"으로 두고, 실제 방문/처리에 필요한 시간을 estimatedMinutes로 추정해라.
- estimatedMinutes는 보통 30, 40, 45, 60 중 적절히 추정
- scheduleStartTime과 scheduleEndTime은 null

4. 단기일정
- 특정 날짜나 시간이 있는 한 번짜리 확정 일정
- 예: 내일 3시 병원, 금요일 6시 친구 약속, 6월 25일 지구과학 시험
- 날짜를 알 수 있으면 dueDate에 YYYY-MM-DD로 넣기
- 시간이 있으면 scheduleStartTime에 HH:mm 형식으로 넣기
- 종료 시간이 명확하지 않으면 scheduleEndTime은 시작 시간으로부터 1시간 뒤로 넣기
- estimatedMinutes는 기본 60
- 오전/오후를 문맥상 판단해라. "저녁 6시"는 18:00, "오후 3시"는 15:00, "아침 8시"는 08:00이다.
- "3시 병원"처럼 오전/오후가 없고 병원/약속/학원 문맥이면 보통 오후로 추정해도 된다.

5. 정기시간표
- 반복되는 고정 일정
- 예: 매주 월수금 영어학원, 매주 토요일 기하학원, 평일 학교
- repeatType은 주기성
- 일정 시간이 있으면 scheduleStartTime과 scheduleEndTime을 채워도 된다.

6. 메모
- 행동보다는 기억할 정보
- 예: 시험범위는 52쪽부터 65쪽
- scheduleStartTime과 scheduleEndTime은 null

7. 아이디어
- 나중에 발전시킬 생각
- 예: 나의 비서에 애플워치 입력 기능 넣기
- scheduleStartTime과 scheduleEndTime은 null

반드시 지켜야 할 것:
- enum에 없는 값은 절대 쓰지 마라.
- status는 항상 "미완료"로 둬라.
- 날짜를 확정할 수 없으면 dueDate는 null로 둬라.
- reminderDate는 명확한 알림 날짜가 없으면 null로 둬라.
- 시간은 반드시 HH:mm 형식으로 써라. 예: "15:00"
- 시간이 없으면 scheduleStartTime과 scheduleEndTime은 null로 둬라.
- title은 사용자가 보기 좋은 짧은 제목으로 정리해라.
          `.trim(),
        },
        {
          role: "user",
          content: text,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "assistant_classification",
          strict: true,
          schema: CLASSIFICATION_SCHEMA,
        },
      },
    });

    const rawText = response.output_text;
    const parsedResult = JSON.parse(rawText) as AssistantItemWithoutId;
    const result = normalizeResult(parsedResult, text);

    return NextResponse.json({
      result,
      source: "ai",
    });
  } catch (error) {
    console.error("AI 분류 실패:", error);

    const fallbackResult = classifyInput(text);

    return NextResponse.json({
      result: fallbackResult,
      source: "fallback",
    });
  }
}
