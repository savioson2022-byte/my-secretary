import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseBrowserConfig } from "@/lib/supabase/config";

const KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token";
const STATE_COOKIE = "kakao_oauth_state";
const NEXT_COOKIE = "kakao_oauth_next";
const NATIVE_COOKIE = "kakao_oauth_native";

function getSafeNextPath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/account";
  }

  return value;
}

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
      <h1>카카오 로그인이 완료됐어요</h1>
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
  const kakaoRestApiKey = process.env.KAKAO_REST_API_KEY;
  const kakaoClientSecret =
    process.env.KAKAO_CLIENT_SECRET ??
    process.env.KAKAO_LOGIN_CLIENT_SECRET ??
    "";
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get(STATE_COOKIE)?.value;
  const nextPath = getSafeNextPath(request.cookies.get(NEXT_COOKIE)?.value);
  const isNative = request.cookies.get(NATIVE_COOKIE)?.value === "1";

  if (!config) {
    return redirectWithError(
      request,
      "Supabase 환경변수가 아직 설정되지 않았습니다."
    );
  }

  if (!kakaoRestApiKey) {
    return redirectWithError(
      request,
      "KAKAO_REST_API_KEY 환경변수가 아직 설정되지 않았습니다."
    );
  }

  if (!code || !state || !storedState || state !== storedState) {
    return redirectWithError(
      request,
      "카카오 로그인 요청이 만료되었습니다. 다시 시도해주세요."
    );
  }

  const callbackUrl = new URL("/api/auth/kakao/callback", request.url);
  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: kakaoRestApiKey,
    redirect_uri: callbackUrl.toString(),
    code,
  });

  if (kakaoClientSecret) {
    tokenBody.set("client_secret", kakaoClientSecret);
  }

  const tokenResponse = await fetch(KAKAO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: tokenBody,
  });

  if (!tokenResponse.ok) {
    console.error("Kakao token exchange failed", {
      status: tokenResponse.status,
      statusText: tokenResponse.statusText,
      hasClientSecret: Boolean(kakaoClientSecret),
    });

    return redirectWithError(
      request,
      "카카오 토큰을 가져오지 못했습니다. 카카오 Redirect URI와 Client Secret 설정을 확인해주세요."
    );
  }

  const tokenData = (await tokenResponse.json()) as { id_token?: string };

  if (!tokenData.id_token) {
    return redirectWithError(
      request,
      "카카오 ID 토큰이 없습니다. 카카오 OpenID Connect 설정을 확인해주세요."
    );
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

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "kakao",
    token: tokenData.id_token,
  });

  if (error) {
    console.error("Supabase Kakao sign-in failed", {
      message: error.message,
      status: error.status,
      name: error.name,
    });

    response = redirectWithError(request, error.message);
  }

  if (!error && isNative && data.session) {
    const nativeRedirectUrl = new URL("mysecretary://auth/session");
    const hashParams = new URLSearchParams({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      next: nextPath,
    });
    nativeRedirectUrl.hash = hashParams.toString();
    response = createNativeHandoffResponse(nativeRedirectUrl);
  }

  response.cookies.delete(STATE_COOKIE);
  response.cookies.delete(NEXT_COOKIE);
  response.cookies.delete(NATIVE_COOKIE);

  return response;
}
