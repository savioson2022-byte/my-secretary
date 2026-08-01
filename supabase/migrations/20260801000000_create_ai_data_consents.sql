create table if not exists public.ai_data_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  consent_version text not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.ai_data_consents enable row level security;

drop policy if exists "Users can read own AI consent" on public.ai_data_consents;
drop policy if exists "Users can insert own AI consent" on public.ai_data_consents;
drop policy if exists "Users can update own AI consent" on public.ai_data_consents;

create policy "Users can read own AI consent" on public.ai_data_consents
  for select using (auth.uid() = user_id);
create policy "Users can insert own AI consent" on public.ai_data_consents
  for insert with check (auth.uid() = user_id);
create policy "Users can update own AI consent" on public.ai_data_consents
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
