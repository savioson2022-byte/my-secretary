-- =============================================================
-- 보안 강화 마이그레이션
-- 1. resolve_app_login_email: anon 역할 EXECUTE 권한 제거
-- 2. purchase_mail_oauth_states: 명시적 RLS 차단 정책 추가
-- =============================================================

-- -----------------------------------------------------------------
-- 1. 이메일 열거 공격 방지 (적용 후 복구됨)
--    원래는 resolve_app_login_email 함수에서 anon 역할 권한을 제거했습니다.
--    하지만 클라이언트 기반 아이디 로그인이 차단되는 부작용이 발견되어,
--    후속 마이그레이션(restore_app_login_email_permission.sql)에서 권한을 다시 복구했습니다.
--    향후 로그인 플로우를 서버 전용 API로 완전히 전환한 뒤 권한을 제거해야 합니다.
-- -----------------------------------------------------------------
revoke execute on function public.resolve_app_login_email(text) from anon;

-- -----------------------------------------------------------------
-- 2. purchase_mail_oauth_states RLS 정책 추가
--    이 테이블은 service_role(Admin Client)로만 접근합니다.
--    authenticated/anon 사용자의 직접 접근을 명시적으로 차단합니다.
-- -----------------------------------------------------------------

-- 안전을 위해 기존 정책이 있으면 제거
drop policy if exists "Block all direct access to oauth states" on public.purchase_mail_oauth_states;

-- authenticated 사용자의 모든 직접 접근을 차단하는 정책
-- service_role은 RLS를 우회하므로 기존 API 동작에 영향 없음
create policy "Block all direct access to oauth states"
  on public.purchase_mail_oauth_states
  for all
  to authenticated
  using (false)
  with check (false);

-- 만료된 OAuth state를 정리하는 유틸 함수 (Cron 또는 수동 호출용)
create or replace function public.cleanup_expired_oauth_states()
returns integer
language sql
security definer
set search_path = public
as $$
  with deleted as (
    delete from public.purchase_mail_oauth_states
    where expires_at < now()
    returning 1
  )
  select count(*)::integer from deleted
$$;

revoke all on function public.cleanup_expired_oauth_states() from public;
grant execute on function public.cleanup_expired_oauth_states() to service_role;
