export const STORAGE_KEYS = {
  assistantItems: "my-assistant-items",
  routineSchedules: "my-assistant-routine-schedules",
  singleSchedules: "my-assistant-single-schedules",
  savedPlaces: "my-assistant-saved-places",
  travelTimeRules: "my-assistant-travel-time-rules",
  travelTimeEstimates: "my-assistant-travel-time-estimates",
  suggestionFeedback: "my-assistant-suggestion-feedback",
  purchaseHistory: "my-assistant-purchase-history",
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
  [STORAGE_KEYS.travelTimeEstimates]: "travel_time_estimates",
  [STORAGE_KEYS.suggestionFeedback]: "suggestion_feedback",
  [STORAGE_KEYS.purchaseHistory]: "purchase_history",
  [STORAGE_KEYS.userProfile]: "profiles",
} as const;

export const USER_SCOPED_STORAGE_KEYS = [
  STORAGE_KEYS.assistantItems,
  STORAGE_KEYS.routineSchedules,
  STORAGE_KEYS.singleSchedules,
  STORAGE_KEYS.savedPlaces,
  STORAGE_KEYS.travelTimeRules,
  STORAGE_KEYS.travelTimeEstimates,
  STORAGE_KEYS.suggestionFeedback,
  STORAGE_KEYS.purchaseHistory,
  STORAGE_KEYS.userProfile,
] as const;
