/**
 * 관리자 권한으로 동작하는 예약 엔드포인트의 공통 인증 경계.
 *
 * Vercel Cron도 CRON_SECRET을 Authorization 헤더로 보내므로, 요청자가
 * 임의로 만들 수 있는 User-Agent나 스케줄 헤더는 인증 근거로 사용하지 않는다.
 * 비밀값이 설정되지 않은 환경에서는 반드시 닫힌 상태로 실패한다.
 */
export function isCronRequestAuthorized(
  headers: Pick<Headers, "get">,
  expectedSecret = process.env.CRON_SECRET
) {
  if (!expectedSecret) return false;

  return (
    headers.get("authorization") === `Bearer ${expectedSecret}` ||
    headers.get("x-cron-secret") === expectedSecret
  );
}
