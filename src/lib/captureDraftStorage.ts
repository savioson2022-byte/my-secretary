const CAPTURE_DRAFT_KEY = "my-assistant-capture-draft";

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
