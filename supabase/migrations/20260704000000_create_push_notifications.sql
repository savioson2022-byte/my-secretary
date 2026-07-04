create extension if not exists pgcrypto;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  device_name text not null default '',
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_schedule_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null,
  source_id text not null,
  occurrence_date date not null,
  start_time time not null,
  title text not null,
  place_name text not null default '',
  reminder_offsets integer[] not null default array[10, 0],
  timezone text not null default 'Asia/Seoul',
  active boolean not null default true,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_type, source_id, occurrence_date)
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  schedule_entry_id uuid not null references public.notification_schedule_entries(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  offset_minutes integer not null,
  delivered_at timestamptz not null default now(),
  unique (schedule_entry_id, subscription_id, offset_minutes)
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions(user_id);

create index if not exists notification_schedule_entries_due_idx
  on public.notification_schedule_entries(occurrence_date, start_time, active);

create index if not exists notification_schedule_entries_user_id_idx
  on public.notification_schedule_entries(user_id);

create index if not exists notification_deliveries_entry_idx
  on public.notification_deliveries(schedule_entry_id, offset_minutes);

alter table public.push_subscriptions enable row level security;
alter table public.notification_schedule_entries enable row level security;
alter table public.notification_deliveries enable row level security;

drop policy if exists "Users can manage own push subscriptions" on public.push_subscriptions;
create policy "Users can manage own push subscriptions"
  on public.push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage own notification schedule entries" on public.notification_schedule_entries;
create policy "Users can manage own notification schedule entries"
  on public.notification_schedule_entries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own notification deliveries" on public.notification_deliveries;
create policy "Users can read own notification deliveries"
  on public.notification_deliveries
  for select
  using (auth.uid() = user_id);
