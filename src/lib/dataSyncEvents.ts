export const CLOUD_DATA_SYNCED_EVENT = "assistant-cloud-data-synced";
export const CLOUD_SYNC_STATUS_STORAGE_KEY = "my-assistant-cloud-sync-status";

export type CloudSyncDomainResult = {
  table: string;
  ok: boolean;
  message?: string;
};

export type CloudSyncStatus = {
  status: "idle" | "success" | "partial" | "failed";
  updatedAt: string;
  results: CloudSyncDomainResult[];
};

export function getCloudDataSyncedEventName() {
  return CLOUD_DATA_SYNCED_EVENT;
}

export function saveCloudSyncStatus(status: CloudSyncStatus) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    CLOUD_SYNC_STATUS_STORAGE_KEY,
    JSON.stringify(status)
  );
}

export function getCloudSyncStatus(): CloudSyncStatus | null {
  if (typeof window === "undefined") return null;

  const rawValue = window.localStorage.getItem(CLOUD_SYNC_STATUS_STORAGE_KEY);
  if (!rawValue) return null;

  try {
    return JSON.parse(rawValue) as CloudSyncStatus;
  } catch {
    return null;
  }
}
