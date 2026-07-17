import type {
  GemmaAdapterProfile,
  GemmaSpecialist,
  LocalAiCapability,
  PersonalAiMemory,
} from "@/types/personalAi";

export const GEMMA_BASE_MODEL =
  "google/gemma-4-E2B-it-qat-mobile-transformers";

export const GEMMA_SPECIALISTS: Record<GemmaSpecialist, GemmaAdapterProfile> = {
  classification: {
    id: "classification",
    label: "작업 분류 전문가",
    capability: "classify_input",
    memoryDomains: ["classification"],
    adapterAsset: "classification.lora",
    systemInstruction:
      "짧은 한국어 입력을 단기일정, 메모, 즉시처리로 분류하고 근거를 구조화한다.",
  },
  schedule: {
    id: "schedule",
    label: "시간 배치 전문가",
    capability: "rank_schedule",
    memoryDomains: ["schedule", "notification"],
    adapterAsset: "schedule.lora",
    systemInstruction:
      "빈 시간, 이동, 장소, 에너지와 사용자 피드백을 함께 고려해 실행 가능한 시간 후보를 평가한다.",
  },
  purchase: {
    id: "purchase",
    label: "재구매 전문가",
    capability: "extract_purchase",
    memoryDomains: ["purchase"],
    adapterAsset: "purchase.lora",
    systemInstruction:
      "주문 정보에서 실제 상품명과 가격을 추출하고 유사 상품의 구매 주기와 재구매 필요성을 판단한다.",
  },
  reservation: {
    id: "reservation",
    label: "예약 에이전트",
    capability: "delegate_reservation",
    memoryDomains: ["classification", "schedule"],
    adapterAsset: "reservation.lora",
    systemInstruction:
      "예약에 필요한 장소, 날짜, 시간, 인원과 누락 조건을 찾아 안전하게 확인 질문 또는 실행안을 만든다.",
  },
  idea: {
    id: "idea",
    label: "아이디어 정리 전문가",
    capability: "group_idea",
    memoryDomains: ["idea"],
    adapterAsset: null,
    systemInstruction:
      "새 메모가 기존 아이디어와 이어지는지 판단하고 같은 주제의 기록을 일관되게 묶는다.",
  },
  notification: {
    id: "notification",
    label: "알림 문구 전문가",
    capability: "compose_notification",
    memoryDomains: ["notification", "schedule"],
    adapterAsset: null,
    systemInstruction:
      "상황과 긴급도에 맞춰 짧고 행동 가능한 한국어 알림 문구를 만든다.",
  },
};

const CAPABILITY_TO_SPECIALIST: Record<LocalAiCapability, GemmaSpecialist> = {
  classify_input: "classification",
  group_idea: "idea",
  rank_schedule: "schedule",
  extract_purchase: "purchase",
  delegate_reservation: "reservation",
  compose_notification: "notification",
};

export function getGemmaSpecialist(capability: LocalAiCapability) {
  return GEMMA_SPECIALISTS[CAPABILITY_TO_SPECIALIST[capability]];
}

export function selectSpecialistMemories({
  capability,
  memories,
}: {
  capability: LocalAiCapability;
  memories: PersonalAiMemory[];
}) {
  const profile = getGemmaSpecialist(capability);
  const domains = new Set(profile.memoryDomains);
  return memories.filter((memory) => domains.has(memory.domain)).slice(0, 12);
}
