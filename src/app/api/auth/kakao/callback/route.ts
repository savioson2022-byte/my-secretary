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
    response = NextResponse.redirect(nativeRedirectUrl);
  }

  response.cookies.delete(STATE_COOKIE);
  response.cookies.delete(NEXT_COOKIE);
  response.cookies.delete(NATIVE_COOKIE);

  return response;
}
