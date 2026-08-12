import type { User } from "@supabase/supabase-js";

export const FIRST_SIGNUP_GUIDE_SEEN_KEY = "time_task_guide_seen_at";

export function shouldShowFirstSignupGuide(user: User, now = Date.now()) {
  if (user.user_metadata?.[FIRST_SIGNUP_GUIDE_SEEN_KEY]) return false;
  if (user.user_metadata?.time_task_guide_pending === true) return true;
  const createdAt = Date.parse(user.created_at);
  return Number.isFinite(createdAt) && now - createdAt >= 0 && now - createdAt <= 30 * 60 * 1000;
}
