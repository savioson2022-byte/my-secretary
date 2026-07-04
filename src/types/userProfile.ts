import { TravelMode } from "@/types/calendar";

export type UserProfile = {
  id: string;
  displayName: string;
  deviceLabel: string;
  classificationPreference: string;
  preferredTravelMode: TravelMode;
  travelTimeAutoCalculationEnabled: boolean;
  rememberDevice: boolean;
  createdAt: string;
  updatedAt: string;
};
