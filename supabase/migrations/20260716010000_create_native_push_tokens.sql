create table if not exists public.native_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'ios',
  token text not null unique,
  device_name text not null default '',
  app_version text not null default '',
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.native_notification_event_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.notification_events(id) on delete cascade,
  native_token_id uuid not null references public.native_push_tokens(id) on delete cascade,
  delivered_at timestamptz not null default now(),
  unique (event_id, native_token_id)
);

create index if not exists native_push_tokens_user_id_idx
  on public.native_push_tokens(user_id);

create index if not exists native_notification_event_deliveries_event_idx
  on public.native_notification_event_deliveries(event_id);

alter table public.native_push_tokens enable row level security;
alter table public.native_notification_event_deliveries enable row level security;

drop policy if exists "Users can manage own native push tokens" on public.native_push_tokens;
create policy "Users can manage own native push tokens"
  on public.native_push_tokens
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read own native notification deliveries" on public.native_notification_event_deliveries;
create policy "Users can read own native notification deliveries"
  on public.native_notification_event_deliveries
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
