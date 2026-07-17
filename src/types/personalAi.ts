export type PersonalAiMemoryDomain =
  | "classification"
  | "idea"
  | "schedule"
  | "purchase"
  | "notification";

export type PersonalAiMemory = {
  id: string;
  domain: PersonalAiMemoryDomain;
  title: string;
  summary: string;
  rules: string[];
  examples: string[];
  confidence: "low" | "medium" | "high";
  source: "user" | "feedback" | "system";
  createdAt: string;
  updatedAt: string;
};

export type LocalAiCapability =
  | "classify_input"
  | "group_idea"
  | "rank_schedule"
  | "extract_purchase"
  | "compose_notification";

export type LocalAiStatus = {
  available: boolean;
  provider: "gemma-on-device";
  modelLabel: string;
  reason: string;
};
