import { UserProfile } from "@/types/userProfile";

const USER_PROFILE_STORAGE_KEY = "my-assistant-user-profile";

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getUserProfile(): UserProfile | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(USER_PROFILE_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as UserProfile;
  } catch {
    return null;
  }
}

export function saveUserProfile(
  profile: Omit<UserProfile, "id" | "createdAt" | "updatedAt"> &
    Partial<Pick<UserProfile, "id" | "createdAt" | "updatedAt">>
) {
  const now = new Date().toISOString();
  const nextProfile: UserProfile = {
    id: profile.id ?? createId(),
    displayName: profile.displayName,
    deviceLabel: profile.deviceLabel,
    classificationPreference: profile.classificationPreference,
    rememberDevice: profile.rememberDevice,
    createdAt: profile.createdAt ?? now,
    updatedAt: now,
  };

  window.localStorage.setItem(
    USER_PROFILE_STORAGE_KEY,
    JSON.stringify(nextProfile)
  );

  return nextProfile;
}

export function deleteUserProfile() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(USER_PROFILE_STORAGE_KEY);
}
