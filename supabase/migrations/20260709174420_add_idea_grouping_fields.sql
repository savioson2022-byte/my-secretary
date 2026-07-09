alter table public.assistant_items
  add column if not exists idea_group_id text,
  add column if not exists idea_group_title text,
  add column if not exists idea_subcategory text;

create index if not exists assistant_items_user_idea_group_idx
  on public.assistant_items(user_id, idea_group_id)
  where idea_group_id is not null;
