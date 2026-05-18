import type { MarketKey } from "@/domain/market";
import { getStorage } from "@/storage";

export interface HistoricalMatch {
  id: string;
  league: string;
  season: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  fthg: number;
  ftag: number;
}

export interface HistoricalOffer {
  matchId: string;
  marketKey: MarketKey;
  selectionSide: string;
  line: number | null;
  decimal: number;
  book: string;
}

interface MatchRow {
  id: string;
  league: string;
  season: string;
  date: string;
  home_team: string;
  away_team: string;
  fthg: number;
  ftag: number;
  ingested_at: string;
}

interface OfferRow {
  match_id: string;
  market_key: MarketKey;
  selection_side: string;
  line: number | null;
  decimal: number;
  book: string;
}

const rowToMatch = (r: MatchRow): HistoricalMatch => ({
  id: r.id,
  league: r.league,
  season: r.season,
  date: r.date,
  homeTeam: r.home_team,
  awayTeam: r.away_team,
  fthg: r.fthg,
  ftag: r.ftag,
});

const rowToOffer = (r: OfferRow): HistoricalOffer => ({
  matchId: r.match_id,
  marketKey: r.market_key,
  selectionSide: r.selection_side,
  line: r.line,
  decimal: r.decimal,
  book: r.book,
});

export interface ListOpts {
  league?: string;
  season?: string;
  limit?: number;
}

export const historicalOddsRepo = {
  async upsertMatch(match: HistoricalMatch): Promise<void> {
    const db = await getStorage();
    await db.execute(
      "INSERT INTO historical_matches(id, league, season, date, home_team, away_team, fthg, ftag, ingested_at) " +
        "VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?) " +
        "ON CONFLICT(id) DO UPDATE SET fthg=excluded.fthg, ftag=excluded.ftag, ingested_at=excluded.ingested_at",
      [
        match.id,
        match.league,
        match.season,
        match.date,
        match.homeTeam,
        match.awayTeam,
        match.fthg,
        match.ftag,
        new Date().toISOString(),
      ],
    );
  },

  async upsertOffer(offer: HistoricalOffer): Promise<void> {
    const db = await getStorage();
    await db.execute(
      "INSERT INTO historical_offers(match_id, market_key, selection_side, line, decimal, book) " +
        "VALUES(?, ?, ?, ?, ?, ?) " +
        "ON CONFLICT(match_id, market_key, selection_side, line) DO UPDATE SET decimal=excluded.decimal, book=excluded.book",
      [
        offer.matchId,
        offer.marketKey,
        offer.selectionSide,
        offer.line ?? 0,
        offer.decimal,
        offer.book,
      ],
    );
  },

  async listMatches(opts: ListOpts = {}): Promise<HistoricalMatch[]> {
    const db = await getStorage();
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (opts.league) {
      where.push("league = ?");
      params.push(opts.league);
    }
    if (opts.season) {
      where.push("season = ?");
      params.push(opts.season);
    }
    const sql =
      "SELECT * FROM historical_matches" +
      (where.length > 0 ? ` WHERE ${where.join(" AND ")}` : "") +
      " ORDER BY date ASC" +
      (opts.limit ? ` LIMIT ${opts.limit}` : "");
    const rows = await db.select<MatchRow>(sql, params);
    return rows.map(rowToMatch);
  },

  async offersFor(matchId: string): Promise<HistoricalOffer[]> {
    const db = await getStorage();
    const rows = await db.select<OfferRow>(
      "SELECT * FROM historical_offers WHERE match_id = ?",
      [matchId],
    );
    return rows.map(rowToOffer);
  },

  async countMatches(opts: ListOpts = {}): Promise<number> {
    const db = await getStorage();
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (opts.league) {
      where.push("league = ?");
      params.push(opts.league);
    }
    if (opts.season) {
      where.push("season = ?");
      params.push(opts.season);
    }
    const sql =
      "SELECT COUNT(*) AS n FROM historical_matches" +
      (where.length > 0 ? ` WHERE ${where.join(" AND ")}` : "");
    const rows = await db.select<{ n: number }>(sql, params);
    return rows[0]?.n ?? 0;
  },

  async clearAll(): Promise<void> {
    const db = await getStorage();
    await db.execute("DELETE FROM historical_offers");
    await db.execute("DELETE FROM historical_matches");
  },
};
