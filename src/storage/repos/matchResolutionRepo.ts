import { getStorage } from "@/storage";

export interface ResolutionRow {
  catalogSource: string;
  catalogId: string;
  oddsProviderId: string;
  oddsEventId: string | null;
  confidence: number;
  resolvedAt: string;
}

interface DbRow {
  catalog_source: string;
  catalog_id: string;
  odds_provider_id: string;
  odds_event_id: string | null;
  confidence: number;
  resolved_at: string;
}

const rowToResolution = (r: DbRow): ResolutionRow => ({
  catalogSource: r.catalog_source,
  catalogId: r.catalog_id,
  oddsProviderId: r.odds_provider_id,
  oddsEventId: r.odds_event_id,
  confidence: r.confidence,
  resolvedAt: r.resolved_at,
});

export const matchResolutionRepo = {
  async get(
    catalogSource: string,
    catalogId: string,
    oddsProviderId: string,
  ): Promise<ResolutionRow | null> {
    const db = await getStorage();
    const rows = await db.select<DbRow>(
      "SELECT * FROM match_resolution WHERE catalog_source = ? AND catalog_id = ? AND odds_provider_id = ? LIMIT 1",
      [catalogSource, catalogId, oddsProviderId],
    );
    return rows[0] ? rowToResolution(rows[0]) : null;
  },

  async upsert(opts: {
    catalogSource: string;
    catalogId: string;
    oddsProviderId: string;
    oddsEventId: string | null;
    confidence: number;
  }): Promise<void> {
    const db = await getStorage();
    await db.execute(
      "INSERT INTO match_resolution(catalog_source, catalog_id, odds_provider_id, odds_event_id, confidence, resolved_at) VALUES(?, ?, ?, ?, ?, ?) " +
        "ON CONFLICT(catalog_source, catalog_id, odds_provider_id) DO UPDATE SET odds_event_id=excluded.odds_event_id, confidence=excluded.confidence, resolved_at=excluded.resolved_at",
      [
        opts.catalogSource,
        opts.catalogId,
        opts.oddsProviderId,
        opts.oddsEventId,
        opts.confidence,
        new Date().toISOString(),
      ],
    );
  },
};
