alter table public.notification_settings
  add column if not exists persistent_alarm_enabled boolean not null default true,
  add column if not exists persistent_alarm_prep_enabled boolean not null default true,
  add column if not exists persistent_alarm_travel_enabled boolean not null default true,
  add column if not exists persistent_alarm_schedule_start_enabled boolean not null default true,
  add column if not exists persistent_alarm_interval_minutes integer not null default 1,
  add column if not exists persistent_alarm_repeat_count integer not null default 5;

alter table public.notification_settings
  drop constraint if exists notification_settings_persistent_alarm_interval_check,
  add constraint notification_settings_persistent_alarm_interval_check check (
    persistent_alarm_interval_minutes between 1 and 10
  ),
  drop constraint if exists notification_settings_persistent_alarm_repeat_count_check,
  add constraint notification_settings_persistent_alarm_repeat_count_check check (
    persistent_alarm_repeat_count between 1 and 10
  );

create table if not exists public.persistent_alarm_acknowledgements (
  user_id uuid not null references auth.users(id) on delete cascade,
  alarm_group_id text not null,
  action text not null,
  snoozed_until timestamptz,
  acknowledged_at timestamptz not null default now(),
  primary key (user_id, alarm_group_id),
  constraint persistent_alarm_acknowledgements_action_check check (
    action in ('confirmed', 'snoozed', 'muted_today')
  )
);

alter table public.persistent_alarm_acknowledgements enable row level security;

drop policy if exists "Users can manage own persistent alarm acknowledgements"
  on public.persistent_alarm_acknowledgements;
create policy "Users can manage own persistent alarm acknowledgements"
  on public.persistent_alarm_acknowledgements
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete
  on table public.persistent_alarm_acknowledgements
  to authenticated;
