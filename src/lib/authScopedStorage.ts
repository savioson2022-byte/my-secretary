const ACTIVE_USER_ID_KEY = "my-assistant-active-user-id";
const SIGNED_OUT_SCOPE = "signed-out";

export function getActiveUserIdForStorage() {
  if (typeof window === "undefined") return null;

  const userId = window.localStorage.getItem(ACTIVE_USER_ID_KEY);
  return userId?.trim() || null;
}

export function setActiveUserIdForStorage(userId: string | null) {
  if (typeof window === "undefined") return;

  if (userId) {
    window.localStorage.setItem(ACTIVE_USER_ID_KEY, userId);
    return;
  }

  window.localStorage.removeItem(ACTIVE_USER_ID_KEY);
}

export function getScopedStorageKey(baseKey: string, userId?: string | null) {
  const activeUserId = userId ?? getActiveUserIdForStorage();
  return `${baseKey}::${activeUserId || SIGNED_OUT_SCOPE}`;
}

export function migrateUnscopedDataToUserStorage({
  baseKeys,
  userId,
}: {
  baseKeys: string[];
  userId: string;
}) {
  if (typeof window === "undefined") return;

  baseKeys.forEach((baseKey) => {
    const rawValue = window.localStorage.getItem(baseKey);
    if (!rawValue) return;

    const scopedKey = getScopedStorageKey(baseKey, userId);
    const scopedValue = window.localStorage.getItem(scopedKey);

    if (!scopedValue) {
      window.localStorage.setItem(scopedKey, rawValue);
    }

    window.localStorage.setItem(`${baseKey}::legacy-backup`, rawValue);
    window.localStorage.removeItem(baseKey);
  });
}
