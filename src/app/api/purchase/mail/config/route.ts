import { NextResponse } from "next/server";
import { createSupabaseUserServerClient } from "@/lib/supabase/server";

async function checkPurchaseMailSchema(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();

  if (!accessToken) {
    return {
      canCheckSchema: false,
      hasPurchaseMailSchema: false,
    };
  }

  const supabase = createSupabaseUserServerClient(accessToken);

  if (!supabase) {
    return {
      canCheckSchema: false,
      hasPurchaseMailSchema: false,
    };
  }

  const { error } = await supabase
    .from("purchase_mail_connections")
    .select("id")
    .limit(1);

  return {
    canCheckSchema: true,
    hasPurchaseMailSchema: !error,
  };
}

export async function GET(request: Request) {
  const hasGoogleOAuth =
    Boolean(process.env.GOOGLE_CLIENT_ID) &&
    Boolean(process.env.GOOGLE_CLIENT_SECRET);
  const hasSupabaseAdmin = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const hasOpenAi = Boolean(process.env.OPENAI_API_KEY);
  const hasCronSecret = Boolean(process.env.CRON_SECRET);

  const schemaStatus = await checkPurchaseMailSchema(request);

  return NextResponse.json({
    hasGoogleOAuth,
    hasSupabaseAdmin,
    hasOpenAi,
    hasCronSecret,
    ...schemaStatus,
    cronSchedule: "하루 1회",
    automationStartDate: "2026-07-14",
  });
}
