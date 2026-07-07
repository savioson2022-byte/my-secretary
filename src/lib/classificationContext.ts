import type { AssistantItem } from "@/types/assistant";
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

  if (item.dueDate) {
    fields.push(`날짜: ${item.dueDate}`);
  }

  if (item.scheduleStartTime) {
    fields.push(`시작: ${item.scheduleStartTime}`);
  }

  return `- ${fields.join(" / ")}`;
}

export function buildClassificationContext({
  inputText,
  items,
  userProfile,
}: {
  inputText: string;
  items: AssistantItem[];
  userProfile: UserProfile | null;
}) {
  const contextParts: string[] = [];

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
