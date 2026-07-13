import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export async function GET() {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260714010000_create_purchase_mail_automation.sql"
  );
  const sql = await readFile(migrationPath, "utf8");

  return new NextResponse(sql, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
