alter table public.app_accounts
  add column if not exists login_id text;

create unique index if not exists app_accounts_login_id_idx
  on public.app_accounts(lower(login_id))
  where login_id is not null and length(trim(login_id)) > 0;

create table if not exists public.app_login_credentials (
  id uuid primary key default gen_random_uuid(),
  app_account_id uuid not null references public.app_accounts(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  login_id text not null,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (auth_user_id)
);

create unique index if not exists app_login_credentials_login_id_idx
  on public.app_login_credentials(lower(login_id));

create index if not exists app_login_credentials_app_account_id_idx
  on public.app_login_credentials(app_account_id);

alter table public.app_login_credentials enable row level security;

drop policy if exists "Users can read own app login credentials" on public.app_login_credentials;
create policy "Users can read own app login credentials"
  on public.app_login_credentials
  for select
  to authenticated
  using (auth_user_id = (select auth.uid()));

drop policy if exists "Users can create own app login credentials" on public.app_login_credentials;
create policy "Users can create own app login credentials"
  on public.app_login_credentials
  for insert
  to authenticated
  with check (
    auth_user_id = (select auth.uid())
    and exists (
      select 1
      from public.app_accounts accounts
      where accounts.id = app_login_credentials.app_account_id
        and (
          accounts.primary_auth_user_id = (select auth.uid())
          or exists (
            select 1
            from public.account_identities identities
            where identities.app_account_id = accounts.id
              and identities.auth_user_id = (select auth.uid())
          )
        )
    )
  );

drop policy if exists "Users can update own app login credentials" on public.app_login_credentials;
create policy "Users can update own app login credentials"
  on public.app_login_credentials
  for update
  to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

create or replace function public.resolve_app_login_email(login_id_input text)
returns text
language sql
security definer
set search_path = public
as $$
  with normalized as (
    select lower(trim(login_id_input)) as login_id
  ),
  credential_match as (
    select credentials.email, credentials.updated_at
    from public.app_login_credentials credentials, normalized
    where lower(credentials.login_id) = normalized.login_id
  ),
  account_identity_match as (
    select
      coalesce(nullif(identities.email, ''), nullif(accounts.primary_email, '')) as email,
      greatest(accounts.updated_at, identities.updated_at) as updated_at
    from public.app_accounts accounts
    left join public.account_identities identities
      on identities.app_account_id = accounts.id,
      normalized
    where lower(accounts.login_id) = normalized.login_id
  )
  select email
  from (
    select email, updated_at from credential_match
    union all
    select email, updated_at from account_identity_match
  ) matches
  where email is not null and length(trim(email)) > 0
  order by updated_at desc
  limit 1
$$;

revoke all on function public.resolve_app_login_email(text) from public;
grant execute on function public.resolve_app_login_email(text) to anon, authenticated;
