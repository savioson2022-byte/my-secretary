import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export async function GET() {
  const migrations = [
    "20260713000000_create_unified_accounts.sql",
    "20260714000000_add_app_login_credentials.sql",
  ];
  const sqlParts = await Promise.all(
    migrations.map(async (migration) => {
      const sql = await readFile(
        path.join(process.cwd(), "supabase", "migrations", migration),
        "utf8"
      );

      return [`-- ${migration}`, sql].join("\n");
    })
  );

  return new NextResponse(sqlParts.join("\n\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
