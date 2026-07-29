import assert from "node:assert/strict";
import { createCipheriv, randomBytes } from "node:crypto";
import {
  decryptToken,
  encryptToken,
  isCurrentEncryptedToken,
  isEncryptedToken,
  reencryptTokenToCurrentVersion,
} from "../src/lib/tokenEncryption.ts";

const PLAINTEXT = "my-secret-token-12345";
const KEY = "d68ec21c9996593b8df3c8c94f4d81aff69cd08b34b84420131d3c31229655cb";

function createV0Token(plaintext = PLAINTEXT) {
  const key = Buffer.from(KEY, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv, {
    authTagLength: 16,
  });
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

async function withEnv(overrides, callback) {
  const original = {
    TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY,
    ALLOW_PLAINTEXT_TOKENS: process.env.ALLOW_PLAINTEXT_TOKENS,
    NODE_ENV: process.env.NODE_ENV,
  };

  try {
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await callback();
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const tests = [
  ["v1 암호화 후 복호화", async () => withEnv(
    { TOKEN_ENCRYPTION_KEY: KEY },
    () => {
      const encrypted = encryptToken(PLAINTEXT);
      assert.equal(isCurrentEncryptedToken(encrypted), true);
      assert.equal(decryptToken(encrypted), PLAINTEXT);
    }
  )],
  ["랜덤 IV 사용", async () => withEnv(
    { TOKEN_ENCRYPTION_KEY: KEY },
    () => assert.notEqual(encryptToken(PLAINTEXT), encryptToken(PLAINTEXT))
  )],
  ["평문 하위 호환", async () => withEnv(
    { TOKEN_ENCRYPTION_KEY: KEY },
    () => assert.equal(decryptToken(PLAINTEXT), PLAINTEXT)
  )],
  ["v0 하위 호환", async () => withEnv(
    { TOKEN_ENCRYPTION_KEY: KEY },
    () => assert.equal(decryptToken(createV0Token()), PLAINTEXT)
  )],
  ["잘못된 키 거부", async () => withEnv(
    { TOKEN_ENCRYPTION_KEY: "short" },
    () => assert.throws(() => encryptToken(PLAINTEXT))
  )],
  ["손상된 v1 거부", async () => withEnv(
    { TOKEN_ENCRYPTION_KEY: KEY },
    () => {
      const encrypted = encryptToken(PLAINTEXT);
      const corrupted = `${encrypted.slice(0, -1)}${encrypted.endsWith("a") ? "b" : "a"}`;
      assert.throws(() => decryptToken(corrupted));
    }
  )],
  ["키 누락 거부", async () => withEnv(
    {
      TOKEN_ENCRYPTION_KEY: undefined,
      ALLOW_PLAINTEXT_TOKENS: undefined,
      NODE_ENV: "development",
    },
    () => assert.throws(() => encryptToken(PLAINTEXT))
  )],
  ["개발 환경 평문 명시 허용", async () => withEnv(
    {
      TOKEN_ENCRYPTION_KEY: undefined,
      ALLOW_PLAINTEXT_TOKENS: "true",
      NODE_ENV: "development",
    },
    () => assert.equal(encryptToken(PLAINTEXT), PLAINTEXT)
  )],
  ["운영 환경 평문 차단", async () => withEnv(
    {
      TOKEN_ENCRYPTION_KEY: undefined,
      ALLOW_PLAINTEXT_TOKENS: "true",
      NODE_ENV: "production",
    },
    () => assert.throws(() => encryptToken(PLAINTEXT))
  )],
  ["평문·v0·v1 판별", async () => withEnv(
    { TOKEN_ENCRYPTION_KEY: KEY },
    () => {
      assert.equal(isEncryptedToken(PLAINTEXT), false);
      assert.equal(isEncryptedToken(createV0Token()), true);
      assert.equal(isEncryptedToken(encryptToken(PLAINTEXT)), true);
      assert.equal(isEncryptedToken("enc:v1:broken"), true);
    }
  )],
  ["v0 형식 오탐 방지", async () => {
    assert.equal(isEncryptedToken("abcdefghijklmnopqrstuvwx:not-a-tag:value"), false);
  }],
  ["빈 문자열 처리", async () => withEnv(
    { TOKEN_ENCRYPTION_KEY: KEY },
    () => {
      assert.equal(encryptToken(""), "");
      assert.equal(decryptToken(""), "");
    }
  )],
  ["오류 메시지 비밀값 미노출", async () => withEnv(
    { TOKEN_ENCRYPTION_KEY: "invalid-secret-key" },
    () => {
      assert.throws(
        () => encryptToken(PLAINTEXT),
        (error) =>
          !error.message.includes(PLAINTEXT) &&
          !error.message.includes("invalid-secret-key")
      );
    }
  )],
  ["평문을 v1으로 전환", async () => withEnv(
    { TOKEN_ENCRYPTION_KEY: KEY },
    () => {
      const upgraded = reencryptTokenToCurrentVersion(PLAINTEXT);
      assert.equal(isCurrentEncryptedToken(upgraded), true);
      assert.equal(decryptToken(upgraded), PLAINTEXT);
    }
  )],
  ["v0를 v1으로 전환", async () => withEnv(
    { TOKEN_ENCRYPTION_KEY: KEY },
    () => {
      const upgraded = reencryptTokenToCurrentVersion(createV0Token());
      assert.equal(isCurrentEncryptedToken(upgraded), true);
      assert.equal(decryptToken(upgraded), PLAINTEXT);
    }
  )],
  ["v1 재암호화 생략", async () => withEnv(
    { TOKEN_ENCRYPTION_KEY: KEY },
    () => {
      const encrypted = encryptToken(PLAINTEXT);
      assert.equal(reencryptTokenToCurrentVersion(encrypted), encrypted);
    }
  )],
];

let passed = 0;
for (const [name, test] of tests) {
  try {
    await test();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}:`, error instanceof Error ? error.message : error);
  }
}

console.log(`${passed}/${tests.length} tests passed`);
if (passed !== tests.length) process.exit(1);
