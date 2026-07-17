import type {
  LocalAiCapability,
  LocalAiStatus,
  PersonalAiMemory,
} from "@/types/personalAi";
import { Capacitor, registerPlugin } from "@capacitor/core";
import {
  GEMMA_BASE_MODEL,
  getGemmaSpecialist,
  selectSpecialistMemories,
} from "@/lib/local-ai/gemmaSpecialists";

type GemmaRuntimePlugin = {
  getStatus(): Promise<{
    available: boolean;
    modelInstalled: boolean;
    runtimeVersion?: string;
    reason?: string;
  }>;
  installModel(): Promise<{ installed: boolean; bytes: number }>;
  deleteModel(): Promise<void>;
  generate(options: {
    baseModel: string;
    specialist: string;
    adapterAsset?: string;
    systemInstruction: string;
    inputJson: string;
    memoriesJson: string;
  }): Promise<{ outputJson: string }>;
};

const GemmaRuntime = registerPlugin<GemmaRuntimePlugin>("GemmaRuntime");

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
  const nativeApp = Capacitor.isNativePlatform();
  return {
    available: false,
    provider: "gemma-on-device",
    modelLabel: "Gemma 4 E2B on-device",
    modelInstalled: false,
    reason: nativeApp
      ? "Gemma 모바일 모델 파일 또는 LiteRT-LM 런타임이 아직 설치되지 않았습니다."
      : "온디바이스 Gemma는 iPhone 앱에서 실행됩니다.",
  };
}

export async function refreshGemmaOnDeviceStatus(): Promise<LocalAiStatus> {
  if (!Capacitor.isNativePlatform()) return getGemmaOnDeviceStatus();

  try {
    const status = await GemmaRuntime.getStatus();
    return {
      available: status.available && status.modelInstalled,
      provider: "gemma-on-device",
      modelLabel: "Gemma 4 E2B on-device",
      modelInstalled: status.modelInstalled,
      runtimeVersion: status.runtimeVersion ?? null,
      reason: status.reason ?? (status.available ? "사용 가능" : "사용 불가"),
    };
  } catch {
    return getGemmaOnDeviceStatus();
  }
}

export async function installGemmaOnDeviceModel() {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("Gemma 모델 설치는 iPhone 앱에서만 할 수 있습니다.");
  }
  return GemmaRuntime.installModel();
}

export async function deleteGemmaOnDeviceModel() {
  if (!Capacitor.isNativePlatform()) return;
  await GemmaRuntime.deleteModel();
}

export async function runGemmaOnDevice<TInput, TOutput>(
  request: LocalAiRequest<TInput>
): Promise<LocalAiResponse<TOutput>> {
  const status = await refreshGemmaOnDeviceStatus();

  if (!status.available) {
    return {
      ok: false,
      output: null,
      source: "fallback",
      reason: `${request.capability}: ${status.reason}`,
    };
  }

  const profile = getGemmaSpecialist(request.capability);
  const memories = selectSpecialistMemories({
    capability: request.capability,
    memories: request.memories,
  });

  try {
    const response = await GemmaRuntime.generate({
      baseModel: GEMMA_BASE_MODEL,
      specialist: profile.id,
      adapterAsset: profile.adapterAsset ?? undefined,
      systemInstruction: profile.systemInstruction,
      inputJson: JSON.stringify(request.input),
      memoriesJson: JSON.stringify(memories),
    });
    return {
      ok: true,
      output: JSON.parse(response.outputJson) as TOutput,
      source: "gemma-on-device",
      reason: `${profile.label}가 기기에서 처리했습니다.`,
    };
  } catch (error) {
    return {
      ok: false,
      output: null,
      source: "fallback",
      reason:
        error instanceof Error
          ? error.message
          : `${profile.label} 실행에 실패했습니다.`,
    };
  }
}
