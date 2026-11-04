import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  buildBriefingResponse,
  hasTokenInQuery,
  isBriefingTokenAuthorized,
  resolveRange,
} from "@/lib/briefing/briefingCore";

/**
 * 외부 브리핑 봇용 읽기 전용 API.
 *
 * - 인증: Authorization: Bearer <BRIEFING_API_TOKEN> (쿼리스트링 토큰 금지)
 * - 대상: BRIEFING_USER_ID로 지정한 사용자 또는 BRIEFING_LOGIN_ID의 통합계정
 * - GET 외 메서드는 405. 쓰기·수정·삭제 기능은 없다.
 * 문서: 옵시디언 01_Projects/나의 비서/11_BriefingAPI.md
 */

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

function jsonResponse(body: unknown, status: number, extraHeaders?: Record<string, string>) {
  return NextResponse.json(body, {
    status,
    headers: { ...NO_STORE_HEADERS, ...extraHeaders },
  });
}

function errorResponse(status: number, message: string, extraHeaders?: Record<string, string>) {
  return jsonResponse({ error: message }, status, extraHeaders);
}

/** 로그인 아이디 → 연결된 auth 사용자 id 전체(같은 통합계정에 묶인 로그인 경로 포함) */
async function resolveBriefingUserIds(
  supabase: SupabaseClient,
  loginId: string,
  pinnedUserId?: string
): Promise<string[] | null> {
  // A server-configured UUID is an explicit account boundary. Do not fall back
  // to display names or user-editable metadata when credential links are absent.
  if (pinnedUserId) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pinnedUserId)) return null;
    const { data, error } = await supabase.auth.admin.getUserById(pinnedUserId);
    if (error || !data.user || data.user.id !== pinnedUserId) return null;
    return [pinnedUserId];
  }

  const { data: credential, error } = await supabase
    .from("app_login_credentials")
    .select("auth_user_id, app_account_id")
    .ilike("login_id", loginId.replace(/[%_\\]/g, (c) => `\\${c}`))
    .maybeSingle();

  if (error || !credential?.auth_user_id) return null;

  const userIds = new Set<string>([credential.auth_user_id as string]);

  if (credential.app_account_id) {
    const { data: identities, error: identitiesError } = await supabase
      .from("account_identities")
      .select("auth_user_id")
      .eq("app_account_id", credential.app_account_id);

    if (identitiesError) throw new Error("briefing identity lookup failed");

    for (const identity of identities ?? []) {
      if (typeof identity.auth_user_id === "string") userIds.add(identity.auth_user_id);
    }
  }

  return Array.from(userIds);
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  if (hasTokenInQuery(url.searchParams)) {
    return errorResponse(400, "토큰은 Authorization 헤더로만 보낼 수 있습니다.");
  }

  if (
    !isBriefingTokenAuthorized(
      request.headers.get("authorization"),
      process.env.BRIEFING_API_TOKEN
    )
  ) {
    return errorResponse(401, "인증이 필요합니다.", {
      "WWW-Authenticate": 'Bearer realm="briefing"',
    });
  }

  const nowMs = Date.now();
  const rangeResult = resolveRange(
    url.searchParams.get("from"),
    url.searchParams.get("to"),
    nowMs
  );

  if (!rangeResult.ok) {
    return errorResponse(400, rangeResult.message);
  }

  const loginId = process.env.BRIEFING_LOGIN_ID?.trim();
  const pinnedUserId = process.env.BRIEFING_USER_ID?.trim();
  const supabase = createSupabaseAdminClient();

  if ((!loginId && !pinnedUserId) || !supabase) {
    console.error("briefing: 서버 설정 누락", {
      hasLoginId: Boolean(loginId),
      hasSupabaseAdmin: Boolean(supabase),
    });
    return errorResponse(503, "브리핑 API가 아직 설정되지 않았습니다.");
  }

  try {
    const userIds = await resolveBriefingUserIds(supabase, loginId ?? "", pinnedUserId);

    if (!userIds || userIds.length === 0) {
      console.error("briefing: 대상 계정을 찾지 못함");
      return errorResponse(503, "브리핑 대상 계정을 찾을 수 없습니다.");
    }

    // 응답 필드는 화이트리스트 매핑으로만 만든다(민감 정보·내부 키 미포함).
    const [singles, routines, items] = await Promise.all([
      supabase
        .from("single_schedules")
        .select("id, title, date, start_time, end_time, place_name, memo, updated_at")
        .in("user_id", userIds),
      supabase
        .from("routine_schedules")
        // cancelled_dates는 선택 컬럼(마이그레이션 미적용 환경 대비)이라 *로 읽고,
        // 응답은 briefingCore의 화이트리스트 매핑으로만 만든다.
        .select("*")
        .in("user_id", userIds),
      supabase
        .from("assistant_items")
        .select(
          "id, title, original_text, category, process_type, priority, status, estimated_minutes, due_date, created_at, updated_at"
        )
        .in("user_id", userIds),
    ]);

    const failed = [singles, routines, items].find((result) => result.error);
    if (failed?.error) {
      console.error("briefing: 데이터 조회 실패", { code: failed.error.code });
      return errorResponse(500, "데이터를 불러오지 못했습니다.");
    }

    const body = buildBriefingResponse({
      nowMs,
      range: rangeResult.range,
      includeDone: url.searchParams.get("includeDone") === "true",
      singleRows: singles.data ?? [],
      routineRows: routines.data ?? [],
      itemRows: items.data ?? [],
    });

    return jsonResponse(body, 200);
  } catch (error) {
    console.error("briefing: 처리 중 오류", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return errorResponse(500, "브리핑을 만들지 못했습니다.");
  }
}

function methodNotAllowed() {
  return errorResponse(405, "GET만 허용됩니다.", { Allow: "GET" });
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;

export const HEAD = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
