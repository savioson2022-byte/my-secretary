import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export async function GET() {
  const purchaseHistorySql = `
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
`.trim();

  const mailAutomationMigrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260714010000_create_purchase_mail_automation.sql"
  );
  const mailAutomationSql = await readFile(mailAutomationMigrationPath, "utf8");
  const sql = [
    "-- 1. 구매템 기본 저장 테이블",
    purchaseHistorySql,
    "",
    "-- 2. 쿠팡 메일 자동 수집 테이블",
    mailAutomationSql,
  ].join("\n");

  return new NextResponse(sql, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
