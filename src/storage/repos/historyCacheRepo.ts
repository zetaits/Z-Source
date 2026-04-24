import { getStorage } from "@/storage";

export interface HistoryCacheRow<T = unknown> {
  cacheKey: string;
  payload: T;
  fetchedAt: string;
}

interface DbRow {
  cache_key: string;
  payload_json: string;
  fetched_at: string;
}

const toRow = <T>(r: DbRow): HistoryCacheRow<T> => ({
  cacheKey: r.cache_key,
  payload: JSON.parse(r.payload_json) as T,
  fetchedAt: r.fetched_at,
});

export const historyCacheRepo = {
  async get<T>(cacheKey: string): Promise<HistoryCacheRow<T> | null> {
    const db = await getStorage();
    const rows = await db.select<DbRow>(
      "SELECT * FROM history_cache WHERE cache_key = ? LIMIT 1",
      [cacheKey],
    );
    return rows[0] ? toRow<T>(rows[0]) : null;
  },

  async upsert<T>(row: HistoryCacheRow<T>): Promise<void> {
    const db = await getStorage();
    await db.execute(
      "INSERT INTO history_cache(cache_key, payload_json, fetched_at) VALUES(?, ?, ?) " +
        "ON CONFLICT(cache_key) DO UPDATE SET payload_json=excluded.payload_json, fetched_at=excluded.fetched_at",
      [row.cacheKey, JSON.stringify(row.payload), row.fetchedAt],
    );
  },

  async evictOlderThan(iso: string): Promise<number> {
    const db = await getStorage();
    const res = await db.execute("DELETE FROM history_cache WHERE fetched_at < ?", [iso]);
    return res.rowsAffected ?? 0;
  },
};

export const formCacheKey = (teamId: number, lastN: number): string =>
  `form:${teamId}:${lastN}`;

export const h2hCacheKey = (homeId: number, awayId: number): string => {
  const [a, b] = [homeId, awayId].sort((x, y) => x - y);
  return `h2h:${a}:${b}`;
};

export const intangiblesCacheKey = (matchId: string): string =>
  `intangibles:${matchId}`;
