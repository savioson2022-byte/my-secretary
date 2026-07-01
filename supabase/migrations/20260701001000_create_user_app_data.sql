create extension if not exists pgcrypto;

create table if not exists public.assistant_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  original_text text not null,
  title text not null,
  category text not null,
  action_type text not null,
  process_type text not null,
  priority text not null,
  repeat_type text not null,
  status text not null,
  estimated_minutes integer,
  due_date date,
  reminder_date date,
  schedule_start_time time,
  schedule_end_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.routine_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  day_of_week text not null,
  start_time time not null,
  end_time time not null,
  place_name text not null default '',
  memo text not null default '',
  start_date date,
  end_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.single_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_item_id uuid references public.assistant_items(id) on delete set null,
  title text not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  place_name text not null default '',
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  address text not null default '',
  memo text not null default '',
  provider text,
  provider_place_id text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.travel_time_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_place_name text not null,
  to_place_name text not null,
  mode text not null,
  minutes integer not null,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assistant_items_user_id_idx
  on public.assistant_items(user_id);

create index if not exists routine_schedules_user_id_idx
  on public.routine_schedules(user_id);

create index if not exists single_schedules_user_id_date_idx
  on public.single_schedules(user_id, date);

create index if not exists places_user_id_name_idx
  on public.places(user_id, name);

create index if not exists travel_time_rules_user_id_route_idx
  on public.travel_time_rules(user_id, from_place_name, to_place_name, mode);

alter table public.assistant_items enable row level security;
alter table public.routine_schedules enable row level security;
alter table public.single_schedules enable row level security;
alter table public.places enable row level security;
alter table public.travel_time_rules enable row level security;

create policy "Users can manage own assistant items"
  on public.assistant_items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own routine schedules"
  on public.routine_schedules
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own single schedules"
  on public.single_schedules
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own places"
  on public.places
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own travel time rules"
  on public.travel_time_rules
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
