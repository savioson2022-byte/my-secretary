alter table public.profiles
  add column if not exists preferred_travel_mode text not null default 'transit';

