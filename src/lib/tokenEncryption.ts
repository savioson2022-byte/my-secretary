import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

/**
 * AES-256-GCM 기반 토큰 암호화/복호화 유틸리티.
 *
 * 환경변수 TOKEN_ENCRYPTION_KEY (hex 64자 = 32바이트)를 사용합니다.
 *
 * 저장 형식 (v1): `enc:v1:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>`
 * 레거시 형식 (v0): `<iv_hex>:<auth_tag_hex>:<ciphertext_hex>`
 *
 * - IV: 12바이트 (24 hex)
 * - Auth Tag: 16바이트 (32 hex)
 * - Ciphertext: 가변 길이
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const SEPARATOR = ":";
const PREFIX_V1 = "enc:v1:";

function getEncryptionKey(): Buffer | null {
  const keyHex = process.env.TOKEN_ENCRYPTION_KEY;

  if (!keyHex) {
    return null;
  }

  if (keyHex.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error("TOKEN_ENCRYPTION_KEY의 길이가 올바르지 않거나 형식이 잘못되었습니다.");
  }

  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY의 바이트 길이가 올바르지 않습니다.");
  }

  return key;
}

/**
 * 평문 저장이 허용되는지 확인합니다.
 * 운영 환경(production)에서는 이 설정이 true여도 무조건 false를 반환하여 평문 저장을 원천 차단합니다.
 */
function isPlaintextAllowed(): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  return process.env.ALLOW_PLAINTEXT_TOKENS === "true";
}

/**
 * 토큰이 암호화된 값인지 판별합니다.
 * v1 형식 또는 v0(레거시) 형식을 지원합니다.
 */
export function isEncryptedToken(value: string): boolean {
  if (!value) return false;
  if (value.startsWith(PREFIX_V1)) return true;

  const parts = value.split(SEPARATOR);
  return (
    parts.length === 3 &&
    /^[0-9a-fA-F]{24}$/.test(parts[0]) &&
    /^[0-9a-fA-F]{32}$/.test(parts[1]) &&
    /^[0-9a-fA-F]+$/.test(parts[2])
  );
}

export function isCurrentEncryptedToken(value: string): boolean {
  return value.startsWith(PREFIX_V1);
}

/**
 * 토큰 암호화가 활성화되어 있는지 확인합니다.
 */
export function isTokenEncryptionEnabled(): boolean {
  try {
    return getEncryptionKey() !== null;
  } catch {
    return false;
  }
}

/**
 * 평문 토큰을 AES-256-GCM으로 암호화합니다. (v1 형식)
 *
 * 키가 없고 ALLOW_PLAINTEXT_TOKENS=true 이면 평문을 반환합니다.
 * 프로덕션 환경이거나 ALLOW_PLAINTEXT_TOKENS가 없으면 Error를 던집니다.
 */
export function encryptToken(plaintext: string): string {
  if (!plaintext) return plaintext;

  const key = getEncryptionKey();

  if (!key) {
    if (isPlaintextAllowed()) {
      return plaintext;
    }
    throw new Error(
      "TOKEN_ENCRYPTION_KEY가 설정되지 않아 토큰을 안전하게 저장할 수 없습니다. " +
        "(프로덕션 환경에서는 평문 저장이 엄격히 금지됩니다.)"
    );
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return (
    PREFIX_V1 +
    [
      iv.toString("hex"),
      authTag.toString("hex"),
      encrypted.toString("hex"),
    ].join(SEPARATOR)
  );
}

/**
 * 암호화된 토큰을 복호화합니다.
 *
 * v1 또는 v0(레거시) 형식을 지원합니다.
 * 평문 토큰(접두사/콜론 2개 없음)인 경우 그대로 반환합니다.
 */
export function decryptToken(stored: string): string {
  if (!stored) return stored;

  if (!isEncryptedToken(stored)) {
    return stored;
  }

  const isV1 = stored.startsWith(PREFIX_V1);
  const parts = isV1
    ? stored.slice(PREFIX_V1.length).split(SEPARATOR)
    : stored.split(SEPARATOR);

  const key = getEncryptionKey();
  if (!key) {
    throw new Error("암호화된 토큰을 복호화하려면 올바른 TOKEN_ENCRYPTION_KEY가 필요합니다.");
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  if (ivHex.length !== IV_LENGTH * 2 || authTagHex.length !== AUTH_TAG_LENGTH * 2) {
    throw new Error("손상된 암호화 토큰 형식입니다.");
  }

  try {
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");

    const decipher = createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch (error) {
    throw new Error("토큰 복호화에 실패했습니다. 키가 올바르지 않거나 데이터가 손상되었습니다.");
  }
}

export function reencryptTokenToCurrentVersion(stored: string): string {
  if (!stored || isCurrentEncryptedToken(stored)) {
    return stored;
  }

  return encryptToken(decryptToken(stored));
}
