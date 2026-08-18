import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export const AI_DATA_CONSENT_VERSION = "2026-08-01";
export const AI_DATA_CONSENT_HEADER = "X-AI-Data-Consent";
const STORAGE_KEY = "my-assistant-ai-data-consent";
export const AI_DATA_CONSENT_CHANGED_EVENT = "my-assistant-ai-data-consent-changed";
export const AI_DATA_CONSENT_REQUESTED_EVENT = "my-assistant-ai-data-consent-requested";

/**
 * 외부 AI가 실제로 필요해진 순간에만 동의 창을 띄운다.
 * 앱을 처음 열자마자 묻지 않기 위해 호출 지점에서 직접 부른다.
 */
export function requestAiDataConsent() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AI_DATA_CONSENT_REQUESTED_EVENT));
}

export type AiDataConsentChoice = "accepted" | "declined" | null;

export function getAiDataConsentChoice(expectedUserId?: string): AiDataConsentChoice {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(STORAGE_KEY);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { version?: string; choice?: string; userId?: string };
    if (parsed.version !== AI_DATA_CONSENT_VERSION) return null;
    if (expectedUserId && parsed.userId !== expectedUserId) return null;
    return parsed.choice === "accepted" || parsed.choice === "declined"
      ? parsed.choice
      : null;
  } catch {
    return null;
  }
}

export async function saveAiDataConsent(choice: Exclude<AiDataConsentChoice, null>) {
  if (typeof window === "undefined") return;
  const decidedAt = new Date().toISOString();
  const supabase = createSupabaseBrowserClient();
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
  const userId = data.session?.user.id;
  if (supabase && userId) {
    const { error } = await supabase.from("ai_data_consents").upsert({
      user_id: userId,
      consent_version: AI_DATA_CONSENT_VERSION,
      accepted_at: choice === "accepted" ? decidedAt : null,
      revoked_at: choice === "declined" ? decidedAt : null,
      updated_at: decidedAt,
    });
    if (error) throw new Error("AI 데이터 전송 선택을 저장하지 못했습니다.");
  }
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: AI_DATA_CONSENT_VERSION, choice, decidedAt, userId })
  );
  window.dispatchEvent(new Event(AI_DATA_CONSENT_CHANGED_EVENT));
}

export function hasAcceptedAiDataConsent() {
  return getAiDataConsentChoice() === "accepted";
}

export async function getAiRequestHeaders() {
  const supabase = createSupabaseBrowserClient();
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
  const token = data.session?.access_token;
  const userId = data.session?.user.id;
  if (!token || !userId || getAiDataConsentChoice(userId) !== "accepted") return null;
  return {
    Authorization: `Bearer ${token}`,
    [AI_DATA_CONSENT_HEADER]: AI_DATA_CONSENT_VERSION,
  };
}
