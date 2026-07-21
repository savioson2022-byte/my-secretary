import { createLocalStorageRepository } from "@/lib/localStorageRepository";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import type { CaptureReview } from "@/types/captureReview";

const CAPTURE_DRAFT_KEY = "my-assistant-capture-draft";
const captureReviewRepository = createLocalStorageRepository<CaptureReview>(
  STORAGE_KEYS.captureReviews
);

export function getCaptureDraft() {
  if (typeof window === "undefined") return "";

  return window.localStorage.getItem(CAPTURE_DRAFT_KEY) ?? "";
}

export function saveCaptureDraft(value: string) {
  if (typeof window === "undefined") return;

  const normalizedValue = value.trim() ? value : "";

  if (!normalizedValue) {
    window.localStorage.removeItem(CAPTURE_DRAFT_KEY);
    return;
  }

  window.localStorage.setItem(CAPTURE_DRAFT_KEY, value);
}

export function clearCaptureDraft() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(CAPTURE_DRAFT_KEY);
}

export function getCaptureReviews() {
  return captureReviewRepository.list();
}

export function saveCaptureReview(review: CaptureReview) {
  captureReviewRepository.create(review);
}

export function updateCaptureReview(review: CaptureReview) {
  captureReviewRepository.update(review);
}
