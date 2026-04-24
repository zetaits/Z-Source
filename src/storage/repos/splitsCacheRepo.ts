import type { MatchId } from "@/domain/ids";
import type { MarketKey } from "@/domain/market";
import type { Splits } from "@/domain/splits";
import { getStorage } from "@/storage";

export interface SplitsCacheRow {
  matchId: MatchId;
  marketKey: MarketKey;
  providerId: string;
  payload: Splits;
  fetchedAt: string;
}

interface DbRow {
  match_id: string;
  market_key: string;
  provider_id: string;
  payload_json: string;
  fetched_at: string;
}

const toRow = (r: DbRow): SplitsCacheRow => ({
  matchId: r.match_id as MatchId,
  marketKey: r.market_key as MarketKey,
  providerId: r.provider_id,
  payload: JSON.parse(r.payload_json) as Splits,
  fetchedAt: r.fetched_at,
});

export const splitsCacheRepo = {
  async get(
    matchId: MatchId,
    marketKey: MarketKey,
    providerId: string,
  ): Promise<SplitsCacheRow | null> {
    const db = await getStorage();
    const rows = await db.select<DbRow>(
      "SELECT * FROM splits_cache WHERE match_id = ? AND market_key = ? AND provider_id = ? LIMIT 1",
      [matchId, marketKey, providerId],
    );
    return rows[0] ? toRow(rows[0]) : null;
  },

  async listForMatch(matchId: MatchId, providerId: string): Promise<SplitsCacheRow[]> {
    const db = await getStorage();
    const rows = await db.select<DbRow>(
      "SELECT * FROM splits_cache WHERE match_id = ? AND provider_id = ?",
      [matchId, providerId],
    );
    return rows.map(toRow);
  },

  async upsert(row: SplitsCacheRow): Promise<void> {
    const db = await getStorage();
    await db.execute(
      "INSERT INTO splits_cache(match_id, market_key, provider_id, payload_json, fetched_at) VALUES(?, ?, ?, ?, ?) " +
        "ON CONFLICT(match_id, market_key, provider_id) DO UPDATE SET payload_json=excluded.payload_json, fetched_at=excluded.fetched_at",
      [
        row.matchId,
        row.marketKey,
        row.providerId,
        JSON.stringify(row.payload),
        row.fetchedAt,
      ],
    );
  },

  async evictOlderThan(iso: string): Promise<number> {
    const db = await getStorage();
    const res = await db.execute("DELETE FROM splits_cache WHERE fetched_at < ?", [iso]);
    return res.rowsAffected ?? 0;
  },
};
