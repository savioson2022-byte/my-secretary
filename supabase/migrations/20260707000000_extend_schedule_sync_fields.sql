alter table public.assistant_items
  add column if not exists color text;

alter table public.routine_schedules
  add column if not exists color text,
  add column if not exists place_address text not null default '',
  add column if not exists place_postal_code text not null default '',
  add column if not exists travel_mode text;

alter table public.single_schedules
  add column if not exists color text,
  add column if not exists place_address text not null default '',
  add column if not exists place_postal_code text not null default '',
  add column if not exists travel_mode text;

alter table public.places
  add column if not exists postal_code text,
  add column if not exists place_type text;
