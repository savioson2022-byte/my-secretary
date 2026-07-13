import { NextResponse } from "next/server";
import { getUserFromAuthorization } from "@/lib/apiAuth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function DELETE(
  request: Request,
  context: {
    params: {
      id: string;
    };
  }
) {
  const auth = await getUserFromAuthorization(request);
  const supabase = createSupabaseAdminClient();

  if (!auth || !supabase) {
    return NextResponse.json(
      {
        error: "로그인이 필요합니다.",
      },
      {
        status: 401,
      }
    );
  }

  const { error } = await supabase
    .from("purchase_mail_connections")
    .delete()
    .eq("id", context.params.id)
    .eq("user_id", auth.user.id);

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
