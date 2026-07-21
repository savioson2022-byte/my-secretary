alter table public.assistant_items
  add column if not exists goal_start_date date,
  add column if not exists goal_total_amount double precision,
  add column if not exists goal_completed_amount double precision not null default 0,
  add column if not exists goal_unit text,
  add column if not exists goal_session_minutes integer;

alter table public.assistant_items
  drop constraint if exists assistant_items_goal_amount_nonnegative,
  add constraint assistant_items_goal_amount_nonnegative
    check (goal_total_amount is null or goal_total_amount >= 0),
  drop constraint if exists assistant_items_goal_completed_nonnegative,
  add constraint assistant_items_goal_completed_nonnegative
    check (goal_completed_amount >= 0),
  drop constraint if exists assistant_items_goal_session_positive,
  add constraint assistant_items_goal_session_positive
    check (goal_session_minutes is null or goal_session_minutes > 0);
