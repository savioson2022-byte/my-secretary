import type { AssistantItem } from "@/types/assistant";
import { formatPersonalAiMemoryForPrompt } from "@/lib/personalAiMemoryStorage";
import type { PersonalAiMemory } from "@/types/personalAi";
import type { UserProfile } from "@/types/userProfile";

const MAX_EXAMPLE_COUNT = 8;

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

function getSimilarityScore(inputText: string, item: AssistantItem) {
  const inputTokens = new Set(tokenize(inputText));
  if (inputTokens.size === 0) return 0;

  const itemTokens = new Set(tokenize(`${item.originalText} ${item.title}`));
  let score = 0;

  inputTokens.forEach((token) => {
    if (itemTokens.has(token)) {
      score += 1;
    }
  });

  return score;
}

function formatExample(item: AssistantItem) {
  const fields = [
    `입력: ${item.originalText}`,
    `제목: ${item.title}`,
    `분야: ${item.category}`,
    `행동: ${item.actionType}`,
    `처리: ${item.processType}`,
    `중요도: ${item.priority}`,
  ];

  if (item.estimatedMinutes) {
    fields.push(`예상시간: ${item.estimatedMinutes}분`);
  }

  if (item.processType === "시간작업") {
    if (item.goalStartDate || item.dueDate) {
      fields.push(`목표기간: ${item.goalStartDate ?? "미정"}~${item.dueDate ?? "미정"}`);
    }
    if (item.goalTotalAmount && item.goalUnit) {
      fields.push(`목표분량: ${item.goalTotalAmount}${item.goalUnit}`);
    }
    if (item.goalSessionMinutes) {
      fields.push(`회당작업: ${item.goalSessionMinutes}분`);
    }
  }

  if (item.dueDate) {
    fields.push(`날짜: ${item.dueDate}`);
  }

  if (item.scheduleStartTime) {
    fields.push(`시작: ${item.scheduleStartTime}`);
  }

  if (item.placePreference === "specific" && item.placeName) {
    fields.push(`장소: ${item.placeName}`);
  } else if (item.placePreference === "anywhere") {
    fields.push("장소: 상관없음");
  }

  return `- ${fields.join(" / ")}`;
}

export function buildClassificationContext({
  inputText,
  items,
  userProfile,
  personalAiMemories = [],
}: {
  inputText: string;
  items: AssistantItem[];
  userProfile: UserProfile | null;
  personalAiMemories?: PersonalAiMemory[];
}) {
  const contextParts: string[] = [];

  const personalAiContext = formatPersonalAiMemoryForPrompt({
    memories: personalAiMemories,
    domains: ["classification", "schedule", "purchase"],
  });

  if (personalAiContext) {
    contextParts.push(personalAiContext);
  }

  if (userProfile?.classificationPreference.trim()) {
    contextParts.push(
      `사용자가 직접 적은 분류 기준:\n${userProfile.classificationPreference.trim()}`
    );
  }

  const examples = [...items]
    .filter((item) => item.status !== "보류")
    .map((item) => ({
      item,
      score: getSimilarityScore(inputText, item),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (
        new Date(b.item.updatedAt).getTime() -
        new Date(a.item.updatedAt).getTime()
      );
    })
    .slice(0, MAX_EXAMPLE_COUNT)
    .map(({ item }) => item);

  if (examples.length > 0) {
    contextParts.push(
      [
        "이전 저장 기록입니다. 사용자가 저장 전에 수정한 결과도 여기에 반영되므로, 비슷한 입력은 아래 사례의 분류 방식을 우선 참고하세요.",
        ...examples.map(formatExample),
      ].join("\n")
    );
  }

  return contextParts.join("\n\n").trim();
}
