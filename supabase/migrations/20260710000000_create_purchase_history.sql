create table if not exists public.purchase_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_name text not null,
  platform text not null default 'coupang',
  product_url text,
  default_quantity integer,
  max_budget_krw integer,
  auto_repurchase_enabled boolean not null default false,
  last_purchased_at timestamptz not null default now(),
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists purchase_history_user_product_idx
  on public.purchase_history(user_id, product_name, platform);

alter table public.purchase_history enable row level security;

drop policy if exists "Users can manage own purchase history" on public.purchase_history;
create policy "Users can manage own purchase history"
  on public.purchase_history
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter table public.assistant_items
  add column if not exists purchase_product_name text,
  add column if not exists purchase_platform text;
