import { runGemmaOnDevice } from "@/lib/local-ai/gemmaAdapter";
import type {
  LocalAiCapability,
  PersonalAiMemory,
} from "@/types/personalAi";

export type PersonalAiFallback<TOutput> = () =>
  | Promise<TOutput>
  | TOutput;

export type PersonalAiExecution<TOutput> = {
  output: TOutput;
  source: "gemma-on-device" | "server-or-rule";
  reason: string;
};

export async function runPersonalAiTask<TInput, TOutput>({
  capability,
  input,
  memories,
  fallback,
}: {
  capability: LocalAiCapability;
  input: TInput;
  memories: PersonalAiMemory[];
  fallback: PersonalAiFallback<TOutput>;
}): Promise<PersonalAiExecution<TOutput>> {
  const localResult = await runGemmaOnDevice<TInput, TOutput>({
    capability,
    input,
    memories,
  });

  if (localResult.ok && localResult.output !== null) {
    return {
      output: localResult.output,
      source: "gemma-on-device",
      reason: localResult.reason,
    };
  }

  return {
    output: await fallback(),
    source: "server-or-rule",
    reason: localResult.reason,
  };
}

export function classifyDelegationCapability(text: string): LocalAiCapability {
  const normalized = text.toLowerCase();

  if (/예약|예매|자리|방문 시간/.test(normalized)) {
    return "delegate_reservation";
  }
  if (/구매|주문|재구매|쿠팡|가격/.test(normalized)) {
    return "extract_purchase";
  }
  if (/언제|시간|배치|빈 시간|스케줄/.test(normalized)) {
    return "rank_schedule";
  }
  return "classify_input";
}
