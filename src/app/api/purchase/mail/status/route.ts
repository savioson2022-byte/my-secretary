import { NextResponse } from "next/server";
import { getAuthedSupabaseForRequest } from "@/lib/apiAuth";

export async function GET(request: Request) {
  const context = await getAuthedSupabaseForRequest(request);

  if (!context?.supabase) {
    return NextResponse.json({
      connections: [],
      isAuthenticated: false,
      message: "로그인 후 메일 자동 수집을 연결할 수 있습니다.",
    });
  }

  const { data, error } = await context.supabase
    .from("purchase_mail_connections")
    .select(
      "id, provider, email, sync_after, last_sync_at, status, last_error, updated_at"
    )
    .eq("user_id", context.auth.user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      {
        connections: [],
        isAuthenticated: true,
        message: "메일 연결 상태를 불러오지 못했습니다.",
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    connections: data ?? [],
    isAuthenticated: true,
  });
}
