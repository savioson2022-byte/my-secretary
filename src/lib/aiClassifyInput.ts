import { AssistantItemWithoutId } from "@/types/assistant";
import { runGemmaOnDevice } from "@/lib/local-ai/gemmaAdapter";
import {
  getGemmaClassificationReadiness,
  getPersonalAiMemories,
} from "@/lib/personalAiMemoryStorage";

export type AiClassifySource = "gemma-on-device" | "ai" | "fallback";

export type AiClassifyInputResult = {
  result: AssistantItemWithoutId;
  source: AiClassifySource;
  gemmaCandidate: AssistantItemWithoutId | null;
};

export async function aiClassifyInput(
  text: string,
  userContext?: string
): Promise<AiClassifyInputResult> {
  const readiness = getGemmaClassificationReadiness();
  const localResult = readiness.shouldEvaluate
    ? await runGemmaOnDevice<
        { text: string; userContext?: string },
        AssistantItemWithoutId
      >({
        capability: "classify_input",
        input: { text, userContext },
        memories: getPersonalAiMemories(),
      })
    : null;

  if (readiness.ready && localResult?.ok && localResult.output) {
    return {
      result: localResult.output,
      source: "gemma-on-device",
      gemmaCandidate: localResult.output,
    };
  }

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

  const data = (await response.json()) as Omit<
    AiClassifyInputResult,
    "gemmaCandidate"
  >;

  return {
    ...data,
    gemmaCandidate: localResult?.ok ? localResult.output : null,
  };
}
