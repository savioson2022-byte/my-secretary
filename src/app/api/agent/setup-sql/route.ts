import { NextResponse } from "next/server";

/**
 * 에이전트 루프가 쓰는 테이블을 만드는 SQL.
 * Supabase SQL 편집기에 붙여넣어 한 번 실행하면 된다.
 */
export async function GET() {
  const sql = `
-- 같은 판단을 하루에 두 번 보내지 않기 위한 발송 기록
create table if not exists public.agent_action_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_id text not null,
  action_kind text not null,
  occurrence_date date not null,
  title text not null default '',
  body text not null default '',
  created_at timestamptz not null default now()
);

-- 이 제약이 중복 발송을 막는다. insert가 실패하면 이미 보낸 판단이다.
create unique index if not exists agent_action_deliveries_unique_idx
  on public.agent_action_deliveries(user_id, action_id, occurrence_date);

create index if not exists agent_action_deliveries_user_date_idx
  on public.agent_action_deliveries(user_id, occurrence_date desc);

alter table public.agent_action_deliveries enable row level security;

drop policy if exists "agent_action_deliveries_select_own"
  on public.agent_action_deliveries;
create policy "agent_action_deliveries_select_own"
  on public.agent_action_deliveries
  for select
  using (auth.uid() = user_id);

-- 사용자가 미루거나 거절한 제안. 서버 루프가 이걸 보고 다시 보내지 않는다.
create table if not exists public.agent_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_id text not null,
  kind text not null check (kind in ('approved', 'snoozed', 'rejected')),
  wake_at timestamptz,
  decided_at timestamptz not null default now()
);

create unique index if not exists agent_decisions_unique_idx
  on public.agent_decisions(user_id, action_id);

alter table public.agent_decisions enable row level security;

drop policy if exists "agent_decisions_own" on public.agent_decisions;
create policy "agent_decisions_own"
  on public.agent_decisions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 오래된 발송 기록 정리 (선택)
-- delete from public.agent_action_deliveries
--   where created_at < now() - interval '60 days';
`.trim();

  return new NextResponse(sql, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
