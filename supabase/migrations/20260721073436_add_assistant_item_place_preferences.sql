alter table if exists public.assistant_items
  add column if not exists place_preference text not null default 'anywhere'
    check (place_preference in ('anywhere', 'specific')),
  add column if not exists place_id uuid,
  add column if not exists place_name text,
  add column if not exists place_address text,
  add column if not exists place_postal_code text;
