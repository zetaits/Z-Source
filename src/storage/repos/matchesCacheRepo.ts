import type { CatalogMatch, MatchStatus } from "@/domain/match";
import { LeagueId } from "@/domain/ids";
import { getStorage } from "@/storage";

interface DbRow {
  match_id: string;
  league_id: string;
  kickoff_at: string;
  home_json: string;
  away_json: string;
  source: string;
  raw_json: string;
  fetched_at: string;
}

interface CachedEntry extends CatalogMatch {
  fetchedAt: string;
}

const rowToCached = (r: DbRow): CachedEntry => {
  const raw = JSON.parse(r.raw_json) as CatalogMatch;
  return {
    ...raw,
    catalogId: r.match_id,
    leagueId: LeagueId(r.league_id),
    kickoffAt: r.kickoff_at,
    source: r.source,
    home: JSON.parse(r.home_json) as CatalogMatch["home"],
    away: JSON.parse(r.away_json) as CatalogMatch["away"],
    status: raw.status as MatchStatus,
    fetchedAt: r.fetched_at,
  };
};

export const matchesCacheRepo = {
  async upsert(matches: CatalogMatch[]): Promise<void> {
    if (matches.length === 0) return;
    const db = await getStorage();
    const fetchedAt = new Date().toISOString();
    for (const m of matches) {
      await db.execute(
        "INSERT INTO matches_cache(match_id, league_id, kickoff_at, home_json, away_json, source, raw_json, fetched_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?) " +
          "ON CONFLICT(match_id) DO UPDATE SET kickoff_at=excluded.kickoff_at, home_json=excluded.home_json, away_json=excluded.away_json, source=excluded.source, raw_json=excluded.raw_json, fetched_at=excluded.fetched_at",
        [
          m.catalogId,
          m.leagueId,
          m.kickoffAt,
          JSON.stringify(m.home),
          JSON.stringify(m.away),
          m.source,
          JSON.stringify(m),
          fetchedAt,
        ],
      );
    }
  },

  async listInRange(opts: {
    leagueIds: LeagueId[];
    from: Date;
    to: Date;
    maxAgeMs: number;
  }): Promise<CatalogMatch[] | null> {
    if (opts.leagueIds.length === 0) return [];
    const db = await getStorage();
    const placeholders = opts.leagueIds.map(() => "?").join(",");
    const rows = await db.select<DbRow>(
      `SELECT * FROM matches_cache WHERE league_id IN (${placeholders}) AND kickoff_at >= ? AND kickoff_at <= ? ORDER BY kickoff_at ASC`,
      [...opts.leagueIds, opts.from.toISOString(), opts.to.toISOString()],
    );
    if (rows.length === 0) return null;
    const stalest = rows.reduce((acc, r) => {
      const t = new Date(r.fetched_at).getTime();
      return t < acc ? t : acc;
    }, Number.POSITIVE_INFINITY);
    if (Date.now() - stalest > opts.maxAgeMs) return null;
    return rows.map(rowToCached);
  },

  async getByCatalogId(catalogId: string): Promise<CatalogMatch | null> {
    const db = await getStorage();
    const rows = await db.select<DbRow>(
      "SELECT * FROM matches_cache WHERE match_id = ? LIMIT 1",
      [catalogId],
    );
    return rows[0] ? rowToCached(rows[0]) : null;
  },

  async listUpcoming(limit = 50): Promise<CatalogMatch[]> {
    const db = await getStorage();
    const rows = await db.select<DbRow>(
      "SELECT * FROM matches_cache WHERE kickoff_at >= ? ORDER BY kickoff_at ASC LIMIT ?",
      [new Date().toISOString(), limit],
    );
    return rows.map(rowToCached);
  },

  async clearOlderThan(cutoffIso: string): Promise<number> {
    const db = await getStorage();
    const r = await db.execute(
      "DELETE FROM matches_cache WHERE kickoff_at < ?",
      [cutoffIso],
    );
    return r.rowsAffected;
  },
};
