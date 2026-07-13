create extension if not exists pgcrypto;

create table if not exists public.app_accounts (
  id uuid primary key default gen_random_uuid(),
  primary_auth_user_id uuid references auth.users(id) on delete set null,
  display_name text not null default '',
  primary_email text not null default '',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.account_identities (
  id uuid primary key default gen_random_uuid(),
  app_account_id uuid not null references public.app_accounts(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_subject text,
  email text,
  display_name text,
  last_sign_in_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (auth_user_id)
);

create unique index if not exists account_identities_provider_subject_idx
  on public.account_identities(provider, provider_subject)
  where provider_subject is not null;

create index if not exists account_identities_app_account_id_idx
  on public.account_identities(app_account_id);

create index if not exists account_identities_email_idx
  on public.account_identities(lower(email))
  where email is not null;

alter table public.app_accounts enable row level security;
alter table public.account_identities enable row level security;

drop policy if exists "Users can read linked app accounts" on public.app_accounts;
create policy "Users can read linked app accounts"
  on public.app_accounts
  for select
  to authenticated
  using (
    primary_auth_user_id = (select auth.uid())
    or exists (
      select 1
      from public.account_identities identities
      where identities.app_account_id = app_accounts.id
        and identities.auth_user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can create own app account" on public.app_accounts;
create policy "Users can create own app account"
  on public.app_accounts
  for insert
  to authenticated
  with check (primary_auth_user_id = (select auth.uid()));

drop policy if exists "Users can update linked app accounts" on public.app_accounts;
create policy "Users can update linked app accounts"
  on public.app_accounts
  for update
  to authenticated
  using (
    primary_auth_user_id = (select auth.uid())
    or exists (
      select 1
      from public.account_identities identities
      where identities.app_account_id = app_accounts.id
        and identities.auth_user_id = (select auth.uid())
    )
  )
  with check (
    primary_auth_user_id = (select auth.uid())
    or exists (
      select 1
      from public.account_identities identities
      where identities.app_account_id = app_accounts.id
        and identities.auth_user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can read own account identities" on public.account_identities;
create policy "Users can read own account identities"
  on public.account_identities
  for select
  to authenticated
  using (auth_user_id = (select auth.uid()));

drop policy if exists "Users can create own account identity" on public.account_identities;
create policy "Users can create own account identity"
  on public.account_identities
  for insert
  to authenticated
  with check (
    auth_user_id = (select auth.uid())
    and exists (
      select 1
      from public.app_accounts accounts
      where accounts.id = account_identities.app_account_id
        and accounts.primary_auth_user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can update own account identity" on public.account_identities;
create policy "Users can update own account identity"
  on public.account_identities
  for update
  to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));
