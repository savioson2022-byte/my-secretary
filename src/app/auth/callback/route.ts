import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseBrowserConfig } from "@/lib/supabase/config";

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/settings";
  }

  return value;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = getSafeNextPath(requestUrl.searchParams.get("next"));
  const config = getSupabaseBrowserConfig();

  if (!config) {
    const redirectUrl = new URL("/settings", request.url);
    redirectUrl.searchParams.set(
      "auth_error",
      "Supabase 환경변수가 아직 설정되지 않았습니다."
    );

    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    const redirectUrl = new URL("/settings", request.url);
    redirectUrl.searchParams.set(
      "auth_error",
      "로그인 확인 코드가 없습니다. 이메일 링크를 다시 요청해주세요."
    );

    return NextResponse.redirect(redirectUrl);
  }

  let response = NextResponse.redirect(new URL(nextPath, request.url));
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const redirectUrl = new URL("/settings", request.url);
    redirectUrl.searchParams.set("auth_error", error.message);
    response = NextResponse.redirect(redirectUrl);
  }

  return response;
}
