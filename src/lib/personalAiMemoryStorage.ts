import {
  createLocalStorageRepository,
  readLocalStorageArray,
} from "@/lib/localStorageRepository";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import type { AssistantItemWithoutId } from "@/types/assistant";
import type {
  PersonalAiMemory,
  PersonalAiMemoryDomain,
} from "@/types/personalAi";

const DEFAULT_MEMORY_IDS: Record<PersonalAiMemoryDomain, string> = {
  classification: "11111111-1111-4111-8111-111111111111",
  idea: "22222222-2222-4222-8222-222222222222",
  schedule: "33333333-3333-4333-8333-333333333333",
  purchase: "44444444-4444-4444-8444-444444444444",
  notification: "55555555-5555-4555-8555-555555555555",
};

const personalAiMemoryRepository =
  createLocalStorageRepository<PersonalAiMemory>(STORAGE_KEYS.personalAiMemory);

function nowIso() {
  return new Date().toISOString();
}

function createDefaultMemory(
  domain: PersonalAiMemoryDomain,
  title: string,
  summary: string,
  rules: string[]
): PersonalAiMemory {
  const now = nowIso();

  return {
    id: DEFAULT_MEMORY_IDS[domain],
    domain,
    title,
    summary,
    rules,
    examples: [],
    confidence: "medium",
    source: "system",
    createdAt: now,
    updatedAt: now,
  };
}

export function getDefaultPersonalAiMemories(): PersonalAiMemory[] {
  return [
    createDefaultMemory(
      "classification",
      "입력 분류 기준",
      "사용자의 짧은 말을 단기일정, 메모, 즉시처리로 안정적으로 나눈다.",
      [
        "날짜와 시간이 명확하면 단기일정으로 본다.",
        "구매, 예약, 연락처럼 바로 처리할 수 있는 요청은 즉시처리로 본다.",
        "아이디어와 정보성 기록은 메모로 저장하고 아이디어 기록과 연결한다.",
      ]
    ),
    createDefaultMemory(
      "idea",
      "아이디어 연결 기준",
      "비슷한 주제의 메모와 아이디어를 같은 흐름으로 묶는다.",
      [
        "같은 제품, 기능, 프로젝트, 소재를 다시 말하면 기존 아이디어 그룹에 붙인다.",
        "새로운 방향이어도 핵심 명사가 같으면 기존 그룹을 먼저 검토한다.",
      ]
    ),
    createDefaultMemory(
      "schedule",
      "시간 추천 기준",
      "빈 시간뿐 아니라 장소, 에너지, 이동 가능성을 함께 본다.",
      [
        "운동은 샤워와 이후 일정 부담을 고려한다.",
        "예약성 작업은 일반 영업시간과 저장된 장소를 우선한다.",
        "이전 피드백이 좋았던 시간대와 장소를 우선 반영한다.",
      ]
    ),
    createDefaultMemory(
      "purchase",
      "구매 위임 기준",
      "반복 구매 내역과 사용자의 선호를 바탕으로 재구매 후보를 고른다.",
      [
        "실제 주문 메일에서 상품명과 가격이 확인된 항목만 재구매 후보로 저장한다.",
        "상품 본품과 부속품을 구분하고, 애매하면 사용자 확인을 받는다.",
      ]
    ),
    createDefaultMemory(
      "notification",
      "알림 문구와 강도 기준",
      "푸시 알림과 지속 알람을 목적에 맞게 분리한다.",
      [
        "준비 시작, 이동 시작, 중요한 일정 시작은 지속 알람 후보로 본다.",
        "재구매 추천, 루틴 상기, 미확정 일정 상기는 푸시 알림 후보로 본다.",
      ]
    ),
  ];
}

function readRawMemories(): PersonalAiMemory[] {
  return readLocalStorageArray<PersonalAiMemory>(STORAGE_KEYS.personalAiMemory);
}

export function getPersonalAiMemories() {
  const customMemories = readRawMemories();
  const customIds = new Set(customMemories.map((memory) => memory.id));
  const missingDefaults = getDefaultPersonalAiMemories().filter(
    (memory) => !customIds.has(memory.id)
  );

  return [...customMemories, ...missingDefaults].sort((left, right) => {
    return left.domain.localeCompare(right.domain);
  });
}

export function savePersonalAiMemory(memory: PersonalAiMemory) {
  const memories = readRawMemories();
  const nextMemory = {
    ...memory,
    updatedAt: nowIso(),
  };
  if (memories.some((item) => item.id === memory.id)) {
    personalAiMemoryRepository.update(nextMemory);
  } else {
    personalAiMemoryRepository.create(nextMemory);
  }
  return nextMemory;
}

export function deletePersonalAiMemory(id: string) {
  const memory = readRawMemories().find((item) => item.id === id);
  if (!memory || memory.source === "system") return false;

  personalAiMemoryRepository.delete(id);
  return true;
}

export function clearPersonalAiFeedbackMemories() {
  readRawMemories()
    .filter((memory) => memory.source === "feedback")
    .forEach((memory) => personalAiMemoryRepository.delete(memory.id));
}

function createFeedbackId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function saveClassificationFeedback({
  original,
  corrected,
}: {
  original: AssistantItemWithoutId;
  corrected: AssistantItemWithoutId;
}) {
  const memories = readRawMemories();
  const input = corrected.originalText.trim();
  const key = input.toLocaleLowerCase();
  const existing = memories.find(
    (memory) =>
      memory.domain === "classification" &&
      memory.source === "feedback" &&
      memory.examples.some((example) => example.toLocaleLowerCase() === key)
  );
  const correctedFields = [
    original.processType !== corrected.processType
      ? `처리 방식은 ${corrected.processType}`
      : null,
    original.category !== corrected.category ? `분야는 ${corrected.category}` : null,
    original.actionType !== corrected.actionType
      ? `행동 유형은 ${corrected.actionType}`
      : null,
  ].filter(Boolean);
  const rule = correctedFields.length
    ? `"${input}"과 비슷한 입력은 ${correctedFields.join(", ")}로 분류한다.`
    : `"${input}"과 비슷한 입력은 ${corrected.processType}, ${corrected.category}, ${corrected.actionType} 분류를 우선한다.`;
  const now = nowIso();
  const memory: PersonalAiMemory = {
    id: existing?.id ?? createFeedbackId(),
    domain: "classification",
    title: `분류 피드백: ${corrected.title}`,
    summary: "사용자가 분류 결과를 확인하거나 직접 수정한 사례다.",
    rules: [rule],
    examples: [input],
    confidence: correctedFields.length ? "high" : "medium",
    source: "feedback",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  if (existing) {
    personalAiMemoryRepository.update(memory);
  } else {
    personalAiMemoryRepository.create(memory);
  }

  const overflowMemories = readRawMemories()
    .filter((item) => item.source === "feedback")
    .slice(60);
  overflowMemories.forEach((item) => personalAiMemoryRepository.delete(item.id));
  return memory;
}

export function formatPersonalAiMemoryForPrompt({
  memories,
  domains,
}: {
  memories: PersonalAiMemory[];
  domains?: PersonalAiMemoryDomain[];
}) {
  const selectedDomains = domains ? new Set(domains) : null;
  const selectedMemories = memories
    .filter((memory) => !selectedDomains || selectedDomains.has(memory.domain))
    .slice(0, 12);

  if (selectedMemories.length === 0) {
    return "";
  }

  return [
    "계정 전체에서 공유되는 개인 AI 메모리입니다. 아이폰과 맥북 모두 같은 기준으로 동작해야 하므로 이 내용을 우선 참고하세요.",
    ...selectedMemories.map((memory) => {
      const rules = memory.rules.map((rule) => `  - ${rule}`).join("\n");
      const examples =
        memory.examples.length > 0
          ? `\n  예시: ${memory.examples.slice(0, 3).join(" / ")}`
          : "";

      return `[${memory.domain}] ${memory.title}: ${memory.summary}\n${rules}${examples}`;
    }),
  ].join("\n");
}
