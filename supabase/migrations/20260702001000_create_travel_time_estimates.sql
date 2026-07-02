create table if not exists public.travel_time_estimates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_place_name text not null,
  to_place_name text not null,
  from_address text not null default '',
  to_address text not null default '',
  departure_time time not null,
  mode text not null,
  minutes integer not null,
  provider text not null default '',
  cache_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, cache_key)
);

create index if not exists travel_time_estimates_user_id_cache_idx
  on public.travel_time_estimates(user_id, cache_key);

alter table public.travel_time_estimates enable row level security;

drop policy if exists "Users can manage own travel time estimates" on public.travel_time_estimates;
create policy "Users can manage own travel time estimates"
  on public.travel_time_estimates
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

