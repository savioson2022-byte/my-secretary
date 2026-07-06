import { NextResponse, type NextRequest } from "next/server";

const KAKAO_AUTHORIZE_URL = "https://kauth.kakao.com/oauth/authorize";
const STATE_COOKIE = "kakao_oauth_state";
const NEXT_COOKIE = "kakao_oauth_next";

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/account";
  }

  return value;
}

function isHttps(request: NextRequest) {
  return (
    request.nextUrl.protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https"
  );
}

export async function GET(request: NextRequest) {
  const kakaoRestApiKey = process.env.KAKAO_REST_API_KEY;
  const nextPath = getSafeNextPath(request.nextUrl.searchParams.get("next"));

  if (!kakaoRestApiKey) {
    const redirectUrl = new URL("/account", request.url);
    redirectUrl.searchParams.set(
      "auth_error",
      "KAKAO_REST_API_KEY 환경변수가 아직 설정되지 않았습니다."
    );

    return NextResponse.redirect(redirectUrl);
  }

  const callbackUrl = new URL("/api/auth/kakao/callback", request.url);
  const state = crypto.randomUUID();
  const authorizeUrl = new URL(KAKAO_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("client_id", kakaoRestApiKey);
  authorizeUrl.searchParams.set("redirect_uri", callbackUrl.toString());
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "openid profile_nickname");
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  const secure = isHttps(request);

  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: 600,
    path: "/",
    sameSite: "lax",
    secure,
  });
  response.cookies.set(NEXT_COOKIE, nextPath, {
    httpOnly: true,
    maxAge: 600,
    path: "/",
    sameSite: "lax",
    secure,
  });

  return response;
}
