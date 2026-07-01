export const STORAGE_KEYS = {
  assistantItems: "my-assistant-items",
  routineSchedules: "my-assistant-routine-schedules",
  singleSchedules: "my-assistant-single-schedules",
  savedPlaces: "my-assistant-saved-places",
  travelTimeRules: "my-assistant-travel-time-rules",
  userProfile: "my-assistant-user-profile",
  voiceControlMode: "my-assistant-voice-control-mode",
} as const;

export const LEGACY_STORAGE_KEYS = {
  places: "my-assistant-places",
  routines: "my-assistant-routines",
  shortTermSchedules: "my-assistant-short-term-schedules",
  travelRules: "my-assistant-travel-rules",
  tasks: "my-assistant-tasks",
} as const;

export const STORAGE_TO_SUPABASE_TABLE = {
  [STORAGE_KEYS.assistantItems]: "assistant_items",
  [STORAGE_KEYS.routineSchedules]: "routine_schedules",
  [STORAGE_KEYS.singleSchedules]: "single_schedules",
  [STORAGE_KEYS.savedPlaces]: "places",
  [STORAGE_KEYS.travelTimeRules]: "travel_time_rules",
  [STORAGE_KEYS.userProfile]: "profiles",
} as const;

