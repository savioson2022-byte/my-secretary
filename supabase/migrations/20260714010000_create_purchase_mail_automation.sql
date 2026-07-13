alter table public.purchase_history
  add column if not exists repeat_cycle_days integer,
  add column if not exists next_purchase_check_date date,
  add column if not exists source text not null default 'manual',
  add column if not exists source_message_id text,
  add column if not exists imported_at timestamptz;

create table if not exists public.purchase_mail_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('gmail', 'naver')),
  email text,
  refresh_token text,
  access_token text,
  access_token_expires_at timestamptz,
  sync_after timestamptz not null default timestamptz '2026-07-14 00:00:00+09',
  last_sync_at timestamptz,
  status text not null default 'active' check (status in ('active', 'paused', 'error')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, email)
);

create index if not exists purchase_mail_connections_user_idx
  on public.purchase_mail_connections(user_id, provider, status);

alter table public.purchase_mail_connections enable row level security;

drop policy if exists "Users can read own purchase mail connection status" on public.purchase_mail_connections;
create policy "Users can read own purchase mail connection status"
  on public.purchase_mail_connections
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.purchase_mail_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('gmail', 'naver')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes')
);

create index if not exists purchase_mail_oauth_states_expires_idx
  on public.purchase_mail_oauth_states(expires_at);

alter table public.purchase_mail_oauth_states enable row level security;

create table if not exists public.purchase_mail_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid references public.purchase_mail_connections(id) on delete set null,
  provider text not null check (provider in ('gmail', 'naver', 'manual')),
  message_id text not null,
  subject text,
  sent_at timestamptz,
  candidate_count integer not null default 0,
  imported_product_names jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, provider, message_id)
);

create index if not exists purchase_mail_imports_user_sent_idx
  on public.purchase_mail_imports(user_id, sent_at desc);

alter table public.purchase_mail_imports enable row level security;

drop policy if exists "Users can read own purchase mail imports" on public.purchase_mail_imports;
create policy "Users can read own purchase mail imports"
  on public.purchase_mail_imports
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
