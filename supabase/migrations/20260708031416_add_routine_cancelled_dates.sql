alter table public.routine_schedules
  add column if not exists cancelled_dates text[] not null default '{}';
