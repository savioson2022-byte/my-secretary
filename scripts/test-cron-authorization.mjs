import assert from "node:assert/strict";
import { isCronRequestAuthorized } from "../src/lib/cronAuthorization.ts";

const secret = "test-cron-secret";

const cases = [
  ["올바른 Bearer 토큰", { authorization: `Bearer ${secret}` }, true],
  ["올바른 x-cron-secret", { "x-cron-secret": secret }, true],
  ["잘못된 Bearer 토큰", { authorization: "Bearer wrong" }, false],
  ["인증 헤더 없음", {}, false],
  [
    "위조 가능한 Vercel 헤더만 있음",
    {
      "user-agent": "vercel-cron/1.0",
      "x-vercel-cron-schedule": "0 22 * * *",
    },
    false,
  ],
];

for (const [name, values, expected] of cases) {
  const headers = new Headers(values);
  assert.equal(isCronRequestAuthorized(headers, secret), expected, name);
}

assert.equal(
  isCronRequestAuthorized(new Headers({ authorization: "Bearer undefined" }), undefined),
  false,
  "CRON_SECRET이 없으면 닫힌 상태로 실패해야 함"
);

console.log(`cron authorization: ${cases.length + 1}/${cases.length + 1} passed`);
