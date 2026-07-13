import { NextResponse, type NextRequest } from "next/server";

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/account";
  }

  return value;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = getSafeNextPath(requestUrl.searchParams.get("next"));

  if (!code) {
    const redirectUrl = new URL("/account", request.url);
    redirectUrl.searchParams.set(
      "auth_error",
      "로그인 확인 코드가 없습니다. 이메일 링크를 다시 요청해주세요."
    );

    return NextResponse.redirect(redirectUrl);
  }

  const completeUrl = new URL("/auth/complete", request.url);
  completeUrl.searchParams.set("code", code);
  completeUrl.searchParams.set("next", nextPath);

  return NextResponse.redirect(completeUrl);
}
