import { isPersistentStorage } from "@/storage";
import { providersQuotaRepo } from "@/storage/repos/providersQuotaRepo";
import { oddsApiIoQuota, oddsApiQuota, type QuotaTracker } from "./quotaTracker";

const TRACKERS: QuotaTracker[] = [oddsApiQuota, oddsApiIoQuota];

let bootstrapped = false;

export const bootstrapQuotaTrackers = async (): Promise<void> => {
  if (bootstrapped || !isPersistentStorage()) {
    bootstrapped = true;
    return;
  }
  bootstrapped = true;
  try {
    const rows = await providersQuotaRepo.listAll();
    const byId = new Map(rows.map((r) => [r.providerId, r]));
    for (const tracker of TRACKERS) {
      const row = byId.get(tracker.providerId);
      if (row) {
        tracker.hydrate({
          remaining: row.remaining,
          used: row.used,
          resetAt: row.resetAt,
          lastSyncedAt: row.lastSyncedAt,
        });
      }
    }
  } catch (err) {
    console.warn("[quota] rehydrate failed", err);
  }

  for (const tracker of TRACKERS) {
    let lastPersistedAt: string | null = null;
    tracker.subscribe((snap) => {
      if (!snap.lastSyncedAt || snap.lastSyncedAt === lastPersistedAt) return;
      lastPersistedAt = snap.lastSyncedAt;
      providersQuotaRepo
        .upsert({
          providerId: tracker.providerId,
          remaining: snap.remaining,
          used: snap.used,
          capacity: tracker.capacity,
          resetAt: snap.resetAt,
          lastSyncedAt: snap.lastSyncedAt,
        })
        .catch((err) => console.warn("[quota] persist failed", err));
    });
  }
};
