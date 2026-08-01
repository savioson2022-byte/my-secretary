import { AI_DATA_CONSENT_HEADER, AI_DATA_CONSENT_VERSION } from "@/lib/aiDataConsent";
import { getAuthedSupabaseForRequest } from "@/lib/apiAuth";

export async function verifyAiDataConsent(request: Request) {
  if (request.headers.get(AI_DATA_CONSENT_HEADER) !== AI_DATA_CONSENT_VERSION) {
    return null;
  }
  const context = await getAuthedSupabaseForRequest(request);
  if (!context?.supabase) return null;
  const { data } = await context.supabase
    .from("ai_data_consents")
    .select("accepted_at, revoked_at, consent_version")
    .eq("user_id", context.auth.user.id)
    .maybeSingle();
  if (
    !data?.accepted_at ||
    data.revoked_at ||
    data.consent_version !== AI_DATA_CONSENT_VERSION
  ) return null;
  return context;
}
