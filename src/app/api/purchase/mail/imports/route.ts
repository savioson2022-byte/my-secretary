import { NextResponse } from "next/server";
import { getAuthedSupabaseForRequest } from "@/lib/apiAuth";

export async function DELETE(request: Request) {
  const context = await getAuthedSupabaseForRequest(request);

  if (!context?.supabase) {
    return NextResponse.json(
      {
        error: "로그인이 필요합니다.",
      },
      {
        status: 401,
      }
    );
  }

  const { error } = await context.supabase
    .from("purchase_mail_imports")
    .update({
      subject: null,
      candidate_count: 0,
      imported_product_names: [],
    })
    .eq("user_id", context.auth.user.id);

  if (error) {
    return NextResponse.json(
      {
        error: "메일 수집 기록을 비우지 못했습니다.",
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    ok: true,
  });
}
