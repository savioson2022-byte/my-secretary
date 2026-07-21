create table if not exists public.capture_review_drafts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  original_text text not null,
  source text not null default 'voice' check (source in ('voice', 'text')),
  status text not null default 'classifying' check (status in ('classifying', 'pending', 'approved', 'failed')),
  classification jsonb,
  classification_source text check (classification_source is null or classification_source in ('gemma-on-device', 'ai', 'fallback')),
  error_message text,
  approved_item_id uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists capture_review_drafts_user_status_updated_idx
  on public.capture_review_drafts (user_id, status, updated_at desc);

alter table public.capture_review_drafts enable row level security;

create policy "Users can read their capture review drafts"
  on public.capture_review_drafts for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their capture review drafts"
  on public.capture_review_drafts for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their capture review drafts"
  on public.capture_review_drafts for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their capture review drafts"
  on public.capture_review_drafts for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.capture_review_drafts to authenticated;
grant all on public.capture_review_drafts to service_role;
