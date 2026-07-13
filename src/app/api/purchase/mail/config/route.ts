import { NextResponse } from "next/server";

export async function GET() {
  const hasGoogleOAuth =
    Boolean(process.env.GOOGLE_CLIENT_ID) &&
    Boolean(process.env.GOOGLE_CLIENT_SECRET);
  const hasSupabaseAdmin = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const hasOpenAi = Boolean(process.env.OPENAI_API_KEY);
  const hasCronSecret = Boolean(process.env.CRON_SECRET);

  return NextResponse.json({
    hasGoogleOAuth,
    hasSupabaseAdmin,
    hasOpenAi,
    hasCronSecret,
    cronSchedule: "하루 1회",
    automationStartDate: "2026-07-14",
  });
}
