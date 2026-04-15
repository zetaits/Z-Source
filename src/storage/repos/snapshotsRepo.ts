import { BookId, MatchId } from "@/domain/ids";
import type { MarketKey, Selection } from "@/domain/market";
import { selectionKey } from "@/domain/market";
import { getStorage } from "@/storage";

export interface SnapshotRow {
  id: number;
  matchId: MatchId;
  marketKey: MarketKey;
  selectionKey: string;
  priceDecimal: number;
  book: BookId;
  takenAt: string;
  isOpener: boolean;
}

interface DbRow {
  id: number;
  match_id: string;
  market_key: MarketKey;
  selection_key: string;
  price_decimal: number;
  book: string;
  taken_at: string;
  is_opener: number;
}

const rowToSnap = (r: DbRow): SnapshotRow => ({
  id: r.id,
  matchId: MatchId(r.match_id),
  marketKey: r.market_key,
  selectionKey: r.selection_key,
  priceDecimal: r.price_decimal,
  book: BookId(r.book),
  takenAt: r.taken_at,
  isOpener: r.is_opener === 1,
});

export const snapshotsRepo = {
  async recordOffer(opts: {
    matchId: MatchId;
    marketKey: MarketKey;
    selection: Selection;
    priceDecimal: number;
    book: BookId;
    takenAt?: string;
    isOpener?: boolean;
  }): Promise<void> {
    const db = await getStorage();
    await db.execute(
      "INSERT INTO odds_snapshots(match_id, market_key, selection_key, price_decimal, book, taken_at, is_opener) VALUES(?, ?, ?, ?, ?, ?, ?)",
      [
        opts.matchId,
        opts.marketKey,
        selectionKey(opts.selection),
        opts.priceDecimal,
        opts.book,
        opts.takenAt ?? new Date().toISOString(),
        opts.isOpener ? 1 : 0,
      ],
    );
  },

  async listForMatch(matchId: MatchId, marketKey?: MarketKey): Promise<SnapshotRow[]> {
    const db = await getStorage();
    const rows = marketKey
      ? await db.select<DbRow>(
          "SELECT * FROM odds_snapshots WHERE match_id = ? AND market_key = ? ORDER BY taken_at ASC",
          [matchId, marketKey],
        )
      : await db.select<DbRow>(
          "SELECT * FROM odds_snapshots WHERE match_id = ? ORDER BY taken_at ASC",
          [matchId],
        );
    return rows.map(rowToSnap);
  },

  async hasOpener(matchId: MatchId): Promise<boolean> {
    const db = await getStorage();
    const rows = await db.select<{ c: number }>(
      "SELECT COUNT(*) as c FROM odds_snapshots WHERE match_id = ? AND is_opener = 1",
      [matchId],
    );
    return (rows[0]?.c ?? 0) > 0;
  },

  async latestFor(
    matchId: MatchId,
    marketKey: MarketKey,
    selection: Selection,
  ): Promise<SnapshotRow | null> {
    const db = await getStorage();
    const rows = await db.select<DbRow>(
      "SELECT * FROM odds_snapshots WHERE match_id = ? AND market_key = ? AND selection_key = ? AND is_opener = 0 ORDER BY taken_at DESC LIMIT 1",
      [matchId, marketKey, selectionKey(selection)],
    );
    return rows[0] ? rowToSnap(rows[0]) : null;
  },
};
