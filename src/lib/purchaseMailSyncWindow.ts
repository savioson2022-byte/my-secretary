const SYNC_LOOKBACK_MS = 1000 * 60 * 60 * 24;
const BACKFILL_LOOKBACK_MS = 1000 * 60 * 60 * 24 * 365;

export function getNextPurchaseMailSyncAfter(now = new Date()) {
  return new Date(now.getTime() - SYNC_LOOKBACK_MS).toISOString();
}

export function getPurchaseMailBackfillSyncAfter(now = new Date()) {
  return new Date(now.getTime() - BACKFILL_LOOKBACK_MS).toISOString();
}
