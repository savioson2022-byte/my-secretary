import { UserProfile } from "@/types/userProfile";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import { getScopedStorageKey } from "@/lib/authScopedStorage";

const DEFAULT_TRAVEL_MODE = "transit";
const DEFAULT_TRAVEL_TIME_AUTO_CALCULATION = true;
const DEFAULT_ENERGY_PATTERN = "balanced";
const DEFAULT_WORKOUT_START_TIME = "17:00";
const DEFAULT_WORKOUT_END_TIME = "21:30";
const DEFAULT_RESERVATION_START_TIME = "10:00";
const DEFAULT_RESERVATION_END_TIME = "20:00";

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

  const rawValue = window.localStorage.getItem(
    getScopedStorageKey(STORAGE_KEYS.userProfile)
  );

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
    | "energyPattern"
    | "workoutPreferredStartTime"
    | "workoutPreferredEndTime"
    | "reservationPreferredStartTime"
    | "reservationPreferredEndTime"
    | "needsShowerAfterWorkout"
  > &
    Partial<Pick<UserProfile, "preferredTravelMode">> &
    Partial<Pick<UserProfile, "travelTimeAutoCalculationEnabled">> &
    Partial<
      Pick<
        UserProfile,
        | "energyPattern"
        | "workoutPreferredStartTime"
        | "workoutPreferredEndTime"
        | "reservationPreferredStartTime"
        | "reservationPreferredEndTime"
        | "needsShowerAfterWorkout"
      >
    > &
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
    energyPattern: profile.energyPattern ?? DEFAULT_ENERGY_PATTERN,
    workoutPreferredStartTime:
      profile.workoutPreferredStartTime ?? DEFAULT_WORKOUT_START_TIME,
    workoutPreferredEndTime:
      profile.workoutPreferredEndTime ?? DEFAULT_WORKOUT_END_TIME,
    reservationPreferredStartTime:
      profile.reservationPreferredStartTime ?? DEFAULT_RESERVATION_START_TIME,
    reservationPreferredEndTime:
      profile.reservationPreferredEndTime ?? DEFAULT_RESERVATION_END_TIME,
    needsShowerAfterWorkout: profile.needsShowerAfterWorkout ?? true,
    rememberDevice: profile.rememberDevice,
    createdAt: profile.createdAt ?? now,
    updatedAt: now,
  };

  window.localStorage.setItem(
    getScopedStorageKey(STORAGE_KEYS.userProfile),
    JSON.stringify(nextProfile)
  );

  return nextProfile;
}

export function deleteUserProfile() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(getScopedStorageKey(STORAGE_KEYS.userProfile));
}
