import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

// Never print the credential or the returned personal records.
const token = process.env.BRIEFING_API_TOKEN || execFileSync(
  "/usr/bin/security",
  ["find-generic-password", "-s", "app.mysecretary.briefing-api", "-a", "newchoee", "-w"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
).trim();
const endpoint = "https://my-secretary-remote.vercel.app/api/briefing";
const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
assert.equal(response.status, 200, "Authenticated request must succeed");
assert.equal(response.headers.get("cache-control"), "no-store");
const body = await response.json();
assert.equal(body.version, 1);
assert.equal(body.timezone, "Asia/Seoul");
for (const name of ["events", "tasks", "notes"]) assert.ok(Array.isArray(body[name]));
assert.equal(JSON.stringify(body).includes('"user_id"'), false);
for (const [suffix, options, expected] of [
  ["", {}, 401],
  ["", { headers: { Authorization: "Bearer invalid-test-token" } }, 401],
  ["?token=dummy", {}, 400],
  ["?from=invalid", { headers: { Authorization: `Bearer ${token}` } }, 400],
  ...["POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map(method => ["", { method }, 405])
]) {
  const check = await fetch(endpoint + suffix, { ...options, signal: AbortSignal.timeout(30000) });
  assert.equal(check.status, expected);
  assert.equal(check.headers.get("cache-control"), "no-store");
  if (expected === 405) assert.equal(check.headers.get("allow"), "GET");
}
console.log(JSON.stringify({ status: "passed", version: body.version, timezone: body.timezone, counts: { events: body.events.length, tasks: body.tasks.length, notes: body.notes.length }, checks: 11 }));
