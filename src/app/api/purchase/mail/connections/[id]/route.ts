import { NextResponse } from "next/server";
import { getAuthedSupabaseForRequest } from "@/lib/apiAuth";

export async function DELETE(
  request: Request,
  context: {
    params: {
      id: string;
    };
  }
) {
  const requestContext = await getAuthedSupabaseForRequest(request);

  if (!requestContext?.supabase) {
    return NextResponse.json(
      {
        error: "로그인이 필요합니다.",
      },
      {
        status: 401,
      }
    );
  }

  const { error } = await requestContext.supabase
    .from("purchase_mail_connections")
    .delete()
    .eq("id", context.params.id)
    .eq("user_id", requestContext.auth.user.id);

  if (error) {
    return NextResponse.json(
      {
        error: "메일 연결 삭제에 실패했습니다.",
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
