import { UserProfile } from "@/types/userProfile";
import { STORAGE_KEYS } from "@/lib/storageKeys";

const DEFAULT_TRAVEL_MODE = "transit";
const DEFAULT_TRAVEL_TIME_AUTO_CALCULATION = true;

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

  const rawValue = window.localStorage.getItem(STORAGE_KEYS.userProfile);

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
  profile: Omit<
    UserProfile,
    | "id"
    | "createdAt"
    | "updatedAt"
    | "preferredTravelMode"
    | "travelTimeAutoCalculationEnabled"
  > &
    Partial<Pick<UserProfile, "preferredTravelMode">> &
    Partial<Pick<UserProfile, "travelTimeAutoCalculationEnabled">> &
    Partial<Pick<UserProfile, "id" | "createdAt" | "updatedAt">>
) {
  const now = new Date().toISOString();
  const nextProfile: UserProfile = {
    id: profile.id ?? createId(),
    displayName: profile.displayName,
    deviceLabel: profile.deviceLabel,
    classificationPreference: profile.classificationPreference,
    preferredTravelMode: profile.preferredTravelMode ?? DEFAULT_TRAVEL_MODE,
    travelTimeAutoCalculationEnabled:
      profile.travelTimeAutoCalculationEnabled ??
      DEFAULT_TRAVEL_TIME_AUTO_CALCULATION,
    rememberDevice: profile.rememberDevice,
    createdAt: profile.createdAt ?? now,
    updatedAt: now,
  };

  window.localStorage.setItem(
    STORAGE_KEYS.userProfile,
    JSON.stringify(nextProfile)
  );

  return nextProfile;
}

export function deleteUserProfile() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEYS.userProfile);
}
