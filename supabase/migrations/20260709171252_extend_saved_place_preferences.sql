alter table public.places
  add column if not exists preferred_visit_start_time time,
  add column if not exists preferred_visit_end_time time,
  add column if not exists typical_stay_minutes integer,
  add column if not exists needs_shower_after_visit boolean;
