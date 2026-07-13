import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseBrowserConfig } from "@/lib/supabase/config";

function redirectWithError(request: NextRequest, message: string) {
  const redirectUrl = new URL("/account", request.url);
  redirectUrl.searchParams.set("auth_error", message);

  return NextResponse.redirect(redirectUrl);
}

export async function GET(request: NextRequest) {
  const config = getSupabaseBrowserConfig();

  if (!config) {
    return redirectWithError(
      request,
      "Supabase 환경변수가 아직 설정되지 않았습니다."
    );
  }

  const response = NextResponse.next();
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

  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    return redirectWithError(
      request,
      "브라우저 로그인 세션을 찾지 못했습니다. Safari에서 로그인 후 다시 시도해주세요."
    );
  }

  const nativeRedirectUrl = new URL("mysecretary://auth/session");
  const hashParams = new URLSearchParams({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    next: "/account",
  });
  nativeRedirectUrl.hash = hashParams.toString();

  return NextResponse.redirect(nativeRedirectUrl);
}
