import { TravelMode } from "@/types/calendar";

export type UserProfile = {
  id: string;
  displayName: string;
  deviceLabel: string;
  classificationPreference: string;
  preferredTravelMode: TravelMode;
  travelTimeAutoCalculationEnabled: boolean;
  energyPattern?: "morning" | "balanced" | "night";
  workoutPreferredStartTime?: string;
  workoutPreferredEndTime?: string;
  reservationPreferredStartTime?: string;
  reservationPreferredEndTime?: string;
  needsShowerAfterWorkout?: boolean;
  instantActionAutoOpenEnabled?: boolean;
  unresolvedDigestEnabled?: boolean;
  unresolvedDigestSnoozedUntil?: string | null;
  rememberDevice: boolean;
  createdAt: string;
  updatedAt: string;
};
