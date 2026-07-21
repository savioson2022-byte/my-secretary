import type { AssistantItemWithoutId } from "@/types/assistant";

export type CaptureReviewStatus =
  | "classifying"
  | "pending"
  | "approved"
  | "failed";

export type CaptureReview = {
  id: string;
  originalText: string;
  source: "voice" | "text";
  status: CaptureReviewStatus;
  classification: AssistantItemWithoutId | null;
  gemmaCandidate: AssistantItemWithoutId | null;
  classificationSource: "gemma-on-device" | "ai" | "fallback" | null;
  errorMessage: string | null;
  approvedItemId: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
