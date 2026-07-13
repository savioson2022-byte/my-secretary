const SYNC_LOOKBACK_MS = 1000 * 60 * 60 * 24;

export function getNextPurchaseMailSyncAfter(now = new Date()) {
  return new Date(now.getTime() - SYNC_LOOKBACK_MS).toISOString();
}
