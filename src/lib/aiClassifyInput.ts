import { AssistantItemWithoutId } from "@/types/assistant";

export type AiClassifySource = "ai" | "fallback";

export type AiClassifyInputResult = {
  result: AssistantItemWithoutId;
  source: AiClassifySource;
};

export async function aiClassifyInput(
  text: string,
  userContext?: string
): Promise<AiClassifyInputResult> {
  const response = await fetch("/api/classify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      userContext,
    }),
  });

  if (!response.ok) {
    throw new Error("AI 분류 요청에 실패했습니다.");
  }

  const data = (await response.json()) as AiClassifyInputResult;

  return data;
}
