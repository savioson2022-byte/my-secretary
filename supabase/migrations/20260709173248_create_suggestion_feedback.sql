create table if not exists public.suggestion_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  item_title text not null,
  suggestion_kind text not null,
  suggestion_date date not null,
  suggestion_start_time time not null,
  suggestion_end_time time not null,
  estimated_minutes integer not null default 0,
  place_name text,
  feedback_type text not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists suggestion_feedback_user_item_idx
  on public.suggestion_feedback(user_id, item_id, updated_at desc);

create index if not exists suggestion_feedback_user_place_idx
  on public.suggestion_feedback(user_id, place_name)
  where place_name is not null;

alter table public.suggestion_feedback enable row level security;

drop policy if exists "Users can manage own suggestion feedback"
  on public.suggestion_feedback;

create policy "Users can manage own suggestion feedback"
  on public.suggestion_feedback
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
