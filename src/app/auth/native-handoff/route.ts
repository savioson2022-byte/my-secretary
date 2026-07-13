import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseBrowserConfig } from "@/lib/supabase/config";

function redirectWithError(request: NextRequest, message: string) {
  const redirectUrl = new URL("/account", request.url);
  redirectUrl.searchParams.set("auth_error", message);

  return NextResponse.redirect(redirectUrl);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function createNativeHandoffResponse(nativeUrl: URL) {
  const href = escapeHtml(nativeUrl.toString());

  return new NextResponse(
    `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>나의 비서 로그인 연결</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #f6f9ff;
        color: #111827;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        width: min(100% - 32px, 420px);
        border-radius: 28px;
        background: white;
        padding: 28px;
        box-shadow: 0 24px 70px rgba(15, 23, 42, 0.12);
        text-align: center;
      }
      .mark {
        width: 56px;
        height: 56px;
        margin: 0 auto 18px;
        display: grid;
        place-items: center;
        border-radius: 20px;
        background: #2563eb;
        color: white;
        font-weight: 900;
        font-size: 24px;
      }
      h1 {
        margin: 0;
        font-size: 24px;
        line-height: 1.25;
      }
      p {
        margin: 12px 0 22px;
        color: #64748b;
        font-size: 15px;
        line-height: 1.65;
      }
      a {
        display: block;
        border-radius: 18px;
        background: #2563eb;
        color: white;
        padding: 16px 18px;
        text-decoration: none;
        font-weight: 900;
      }
      small {
        display: block;
        margin-top: 14px;
        color: #94a3b8;
        font-size: 12px;
        line-height: 1.5;
      }
    </style>
  </head>
  <body>
    <main>
      <div class="mark">나</div>
      <h1>로그인이 완료됐어요</h1>
      <p>아래 버튼을 눌러 나의 비서 앱으로 돌아가면 로그인 상태가 앱에 저장됩니다.</p>
      <a href="${href}">나의 비서 앱으로 돌아가기</a>
      <small>자동으로 앱이 열리지 않으면 이 버튼을 한 번 더 눌러주세요.</small>
    </main>
  </body>
</html>`,
    {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    }
  );
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

  return createNativeHandoffResponse(nativeRedirectUrl);
}
