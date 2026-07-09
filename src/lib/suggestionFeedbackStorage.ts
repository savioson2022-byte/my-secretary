import { createLocalStorageRepository } from "@/lib/localStorageRepository";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import type {
  SuggestionFeedback,
  SuggestionFeedbackType,
} from "@/types/suggestionFeedback";

type SuggestionSnapshot = {
  itemId: string;
  title: string;
  kind: SuggestionFeedback["suggestionKind"];
  date: string;
  startTime: string;
  endTime: string;
  estimatedMinutes: number;
  placeName: string | null;
};

const suggestionFeedbackRepository =
  createLocalStorageRepository<SuggestionFeedback>(
    STORAGE_KEYS.suggestionFeedback
  );

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isSameSuggestion(
  feedback: SuggestionFeedback,
  suggestion: SuggestionSnapshot
) {
  return (
    feedback.itemId === suggestion.itemId &&
    feedback.suggestionDate === suggestion.date &&
    feedback.suggestionStartTime === suggestion.startTime &&
    feedback.suggestionEndTime === suggestion.endTime &&
    (feedback.placeName ?? "") === (suggestion.placeName ?? "")
  );
}

export function getSuggestionFeedbacks(): SuggestionFeedback[] {
  return suggestionFeedbackRepository.list();
}

export function saveSuggestionFeedbackForSuggestion({
  suggestion,
  feedbackType,
  note = "",
}: {
  suggestion: SuggestionSnapshot;
  feedbackType: SuggestionFeedbackType;
  note?: string;
}) {
  const now = new Date().toISOString();
  const existingFeedback = getSuggestionFeedbacks().find((feedback) =>
    isSameSuggestion(feedback, suggestion)
  );
  const nextFeedback: SuggestionFeedback = {
    id: existingFeedback?.id ?? createId(),
    itemId: suggestion.itemId,
    itemTitle: suggestion.title,
    suggestionKind: suggestion.kind,
    suggestionDate: suggestion.date,
    suggestionStartTime: suggestion.startTime,
    suggestionEndTime: suggestion.endTime,
    estimatedMinutes: suggestion.estimatedMinutes,
    placeName: suggestion.placeName,
    feedbackType,
    note,
    createdAt: existingFeedback?.createdAt ?? now,
    updatedAt: now,
  };

  if (existingFeedback) {
    suggestionFeedbackRepository.update(nextFeedback);
  } else {
    suggestionFeedbackRepository.create(nextFeedback);
  }

  return nextFeedback;
}
