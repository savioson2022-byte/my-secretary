create table if not exists public.personal_ai_memory (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  domain text not null,
  title text not null,
  summary text not null default '',
  rules text[] not null default '{}',
  examples text[] not null default '{}',
  confidence text not null default 'medium',
  source text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists personal_ai_memory_user_domain_idx
  on public.personal_ai_memory(user_id, domain);

alter table public.personal_ai_memory enable row level security;

drop policy if exists "Users can manage own personal ai memory" on public.personal_ai_memory;
create policy "Users can manage own personal ai memory"
  on public.personal_ai_memory
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
