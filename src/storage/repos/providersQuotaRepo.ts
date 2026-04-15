import { getStorage } from "@/storage";

export interface ProviderQuotaRow {
  providerId: string;
  remaining: number | null;
  used: number | null;
  capacity: number | null;
  resetAt: string | null;
  lastSyncedAt: string;
}

interface DbRow {
  provider_id: string;
  remaining: number | null;
  used: number | null;
  capacity: number | null;
  reset_at: string | null;
  last_synced_at: string;
}

const toRow = (r: DbRow): ProviderQuotaRow => ({
  providerId: r.provider_id,
  remaining: r.remaining,
  used: r.used,
  capacity: r.capacity,
  resetAt: r.reset_at,
  lastSyncedAt: r.last_synced_at,
});

export const providersQuotaRepo = {
  async get(providerId: string): Promise<ProviderQuotaRow | null> {
    const db = await getStorage();
    const rows = await db.select<DbRow>(
      "SELECT * FROM providers_quota WHERE provider_id = ? LIMIT 1",
      [providerId],
    );
    return rows[0] ? toRow(rows[0]) : null;
  },
  async listAll(): Promise<ProviderQuotaRow[]> {
    const db = await getStorage();
    const rows = await db.select<DbRow>("SELECT * FROM providers_quota");
    return rows.map(toRow);
  },
  async upsert(row: ProviderQuotaRow): Promise<void> {
    const db = await getStorage();
    await db.execute(
      "INSERT INTO providers_quota(provider_id, remaining, used, capacity, reset_at, last_synced_at) VALUES(?, ?, ?, ?, ?, ?) " +
        "ON CONFLICT(provider_id) DO UPDATE SET remaining=excluded.remaining, used=excluded.used, capacity=excluded.capacity, reset_at=excluded.reset_at, last_synced_at=excluded.last_synced_at",
      [
        row.providerId,
        row.remaining,
        row.used,
        row.capacity,
        row.resetAt,
        row.lastSyncedAt,
      ],
    );
  },
};
