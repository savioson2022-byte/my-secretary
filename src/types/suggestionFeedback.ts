export type SuggestionFeedbackType = "good" | "bad" | "wrong_place";

export type SuggestionFeedback = {
  id: string;
  itemId: string;
  itemTitle: string;
  suggestionKind: "time-task" | "reservation-candidate";
  suggestionDate: string;
  suggestionStartTime: string;
  suggestionEndTime: string;
  estimatedMinutes: number;
  placeName: string | null;
  feedbackType: SuggestionFeedbackType;
  note: string;
  createdAt: string;
  updatedAt: string;
};
