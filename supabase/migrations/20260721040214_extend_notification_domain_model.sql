-- Notification domain model
--
-- notification_rules: user intent and recurrence configuration
-- notification_events: concrete occurrences produced from rules or app data
-- notification_delivery_attempts: channel-independent delivery history

create table if not exists public.notification_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  notification_type text not null,
  source_type text not null default 'custom',
  source_id text,
  enabled boolean not null default true,
  schedule_type text not null default 'derived',
  timezone text not null default 'Asia/Seoul',
  scheduled_time time,
  starts_at timestamptz,
  ends_at timestamptz,
  days_of_week smallint[] not null default '{}',
  day_of_month smallint,
  interval_minutes integer,
  lead_minutes integer[] not null default '{0}',
  delivery_channels text[] not null default '{in_app,web_push}',
  sound_enabled boolean not null default true,
  sound_key text not null default 'default',
  require_interaction boolean not null default false,
  snooze_minutes integer[] not null default '{5,10}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_rules_id_user_unique unique (id, user_id),
  constraint notification_rules_type_check check (
    notification_type in (
      'time_based',
      'time_task',
      'period_task',
      'ai_recommendation',
      'recurring',
      'daily_summary',
      'sleep',
      'wake',
      'custom_alarm'
    )
  ),
  constraint notification_rules_schedule_type_check check (
    schedule_type in ('once', 'daily', 'weekly', 'monthly', 'interval', 'derived')
  ),
  constraint notification_rules_days_check check (
    days_of_week <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
  ),
  constraint notification_rules_day_of_month_check check (
    day_of_month is null or day_of_month between 1 and 31
  ),
  constraint notification_rules_interval_check check (
    interval_minutes is null or interval_minutes > 0
  ),
  constraint notification_rules_lead_minutes_check check (
    0 <= all(lead_minutes) and 10080 >= all(lead_minutes)
  ),
  constraint notification_rules_channels_check check (
    delivery_channels <@ array[
      'in_app',
      'web_push',
      'native_push',
      'kakao',
      'apple_watch'
    ]::text[]
  ),
  constraint notification_rules_snooze_check check (
    1 <= all(snooze_minutes) and 1440 >= all(snooze_minutes)
  ),
  constraint notification_rules_date_range_check check (
    ends_at is null or starts_at is null or ends_at >= starts_at
  )
);

alter table public.notification_events
  add column if not exists rule_id uuid,
  add column if not exists notification_type text not null default 'time_based',
  add column if not exists priority text not null default 'normal',
  add column if not exists delivery_channels text[] not null default '{in_app,web_push}',
  add column if not exists sound_enabled boolean not null default true,
  add column if not exists sound_key text not null default 'default',
  add column if not exists require_interaction boolean not null default false,
  add column if not exists expires_at timestamptz,
  add column if not exists payload jsonb not null default '{}'::jsonb;

alter table public.notification_events
  add constraint notification_events_id_user_unique unique (id, user_id),
  add constraint notification_events_rule_user_fk
    foreign key (rule_id, user_id)
    references public.notification_rules(id, user_id)
    on delete set null (rule_id),
  add constraint notification_events_notification_type_check check (
    notification_type in (
      'time_based',
      'time_task',
      'period_task',
      'ai_recommendation',
      'recurring',
      'daily_summary',
      'sleep',
      'wake',
      'custom_alarm'
    )
  ),
  add constraint notification_events_priority_check check (
    priority in ('low', 'normal', 'high', 'urgent')
  ),
  add constraint notification_events_channels_check check (
    delivery_channels <@ array[
      'in_app',
      'web_push',
      'native_push',
      'kakao',
      'apple_watch'
    ]::text[]
  ),
  add constraint notification_events_expiry_check check (
    expires_at is null or expires_at >= scheduled_at
  );

create table if not exists public.notification_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null,
  channel text not null,
  destination_id text not null default '',
  status text not null default 'pending',
  provider_message_id text,
  error_code text,
  error_message text,
  attempted_at timestamptz not null default now(),
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notification_delivery_attempts_channel_check check (
    channel in ('in_app', 'web_push', 'native_push', 'kakao', 'apple_watch')
  ),
  constraint notification_delivery_attempts_status_check check (
    status in ('pending', 'sent', 'delivered', 'failed', 'skipped')
  ),
  constraint notification_delivery_attempts_event_user_fk
    foreign key (event_id, user_id)
    references public.notification_events(id, user_id)
    on delete cascade,
  unique (event_id, channel, destination_id)
);

alter table public.notification_settings
  add column if not exists notifications_enabled boolean not null default true,
  add column if not exists push_enabled boolean not null default true,
  add column if not exists in_app_alarm_enabled boolean not null default true,
  add column if not exists sound_enabled boolean not null default true,
  add column if not exists time_task_notifications_enabled boolean not null default true,
  add column if not exists period_task_notifications_enabled boolean not null default true,
  add column if not exists ai_recommendations_enabled boolean not null default true,
  add column if not exists repeating_notifications_enabled boolean not null default true,
  add column if not exists daily_summary_enabled boolean not null default false,
  add column if not exists daily_summary_time time not null default '08:00',
  add column if not exists default_snooze_minutes integer not null default 10;

alter table public.notification_settings
  add constraint notification_settings_snooze_minutes_check check (
    default_snooze_minutes between 1 and 1440
  );

create index if not exists notification_rules_user_enabled_idx
  on public.notification_rules(user_id, enabled);

create index if not exists notification_rules_source_idx
  on public.notification_rules(user_id, source_type, source_id);

create index if not exists notification_events_rule_scheduled_idx
  on public.notification_events(rule_id, scheduled_at)
  where rule_id is not null;

create index if not exists notification_delivery_attempts_event_idx
  on public.notification_delivery_attempts(event_id, channel, status);

create index if not exists notification_delivery_attempts_user_attempted_idx
  on public.notification_delivery_attempts(user_id, attempted_at desc);

alter table public.notification_rules enable row level security;
alter table public.notification_delivery_attempts enable row level security;

create policy "Users can manage own notification rules"
  on public.notification_rules
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can read own notification delivery attempts"
  on public.notification_delivery_attempts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- New Supabase projects require explicit Data API grants. RLS remains the
-- authorization boundary for authenticated users.
grant select, insert, update, delete
  on table public.notification_rules
  to authenticated;

grant select
  on table public.notification_delivery_attempts
  to authenticated;

grant all
  on table public.notification_rules,
    public.notification_delivery_attempts
  to service_role;

comment on table public.notification_rules is
  'User-owned notification rules, recurrence, channels, sound, and snooze preferences.';

comment on table public.notification_delivery_attempts is
  'Channel-independent notification delivery audit for web, native, in-app, and future providers.';
