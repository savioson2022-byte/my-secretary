import type {
  LocalAiCapability,
  LocalAiStatus,
  PersonalAiMemory,
} from "@/types/personalAi";

export type LocalAiRequest<TInput> = {
  capability: LocalAiCapability;
  input: TInput;
  memories: PersonalAiMemory[];
};

export type LocalAiResponse<TOutput> = {
  ok: boolean;
  output: TOutput | null;
  source: "gemma-on-device" | "fallback";
  reason: string;
};

export function getGemmaOnDeviceStatus(): LocalAiStatus {
  return {
    available: false,
    provider: "gemma-on-device",
    modelLabel: "Gemma 4 on-device",
    reason:
      "온디바이스 모델 런타임은 아직 연결되지 않았습니다. 앱은 개인 AI 메모리를 먼저 동기화하고, 모델이 붙으면 같은 인터페이스로 호출합니다.",
  };
}

export async function runGemmaOnDevice<TInput, TOutput>(
  request: LocalAiRequest<TInput>
): Promise<LocalAiResponse<TOutput>> {
  const status = getGemmaOnDeviceStatus();

  if (!status.available) {
    return {
      ok: false,
      output: null,
      source: "fallback",
      reason: `${request.capability}: ${status.reason}`,
    };
  }

  return {
    ok: false,
    output: null,
    source: "fallback",
    reason: "Gemma 런타임 연결 후 이 지점에서 네이티브 추론 결과를 반환합니다.",
  };
}
