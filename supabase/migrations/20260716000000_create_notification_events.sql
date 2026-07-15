create table if not exists public.notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schedule_notifications_enabled boolean not null default true,
  travel_notifications_enabled boolean not null default true,
  purchase_notifications_enabled boolean not null default true,
  routine_reminder_enabled boolean not null default true,
  location_notifications_enabled boolean not null default false,
  default_prep_lead_minutes integer not null default 30,
  travel_buffer_minutes integer not null default 5,
  location_check_window_minutes integer not null default 90,
  preferred_travel_mode text not null default 'transit',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  client_event_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  source_type text not null,
  source_id text not null,
  occurrence_date date not null,
  scheduled_at timestamptz not null,
  title text not null,
  body text not null default '',
  url text not null default '/',
  place_name text not null default '',
  place_address text not null default '',
  latitude double precision,
  longitude double precision,
  requires_location_check boolean not null default false,
  active boolean not null default true,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_event_id)
);

create table if not exists public.notification_event_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.notification_events(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  delivered_at timestamptz not null default now(),
  unique (event_id, subscription_id)
);

create index if not exists notification_events_due_idx
  on public.notification_events(scheduled_at, active);

create index if not exists notification_events_user_id_idx
  on public.notification_events(user_id);

create index if not exists notification_event_deliveries_event_idx
  on public.notification_event_deliveries(event_id);

alter table public.notification_settings enable row level security;
alter table public.notification_events enable row level security;
alter table public.notification_event_deliveries enable row level security;

drop policy if exists "Users can manage own notification settings" on public.notification_settings;
create policy "Users can manage own notification settings"
  on public.notification_settings
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage own notification events" on public.notification_events;
create policy "Users can manage own notification events"
  on public.notification_events
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read own notification event deliveries" on public.notification_event_deliveries;
create policy "Users can read own notification event deliveries"
  on public.notification_event_deliveries
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
