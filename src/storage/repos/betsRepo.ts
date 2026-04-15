import type { Bet, BetStatus } from "@/domain/bet";
import { BetId, BookId, LeagueId, MatchId } from "@/domain/ids";
import type { MarketKey, Selection } from "@/domain/market";
import type { PlayCandidate } from "@/domain/play";
import { getStorage } from "@/storage";

interface BetRow {
  id: string;
  placed_at: string;
  match_id: string;
  league_id: string;
  market_key: MarketKey;
  selection_json: string;
  price_decimal: number;
  book: string;
  stake_units: number;
  stake_minor: number;
  status: BetStatus;
  settled_at: string | null;
  payout_minor: number | null;
  closing_price_decimal: number | null;
  notes: string | null;
  play_snapshot_json: string | null;
}

const rowToBet = (r: BetRow): Bet => ({
  id: BetId(r.id),
  placedAt: r.placed_at,
  matchId: MatchId(r.match_id),
  leagueId: LeagueId(r.league_id),
  marketKey: r.market_key,
  selection: JSON.parse(r.selection_json) as Selection,
  priceDecimal: r.price_decimal,
  book: BookId(r.book),
  stakeUnits: r.stake_units,
  stakeMinor: r.stake_minor,
  status: r.status,
  settledAt: r.settled_at ?? undefined,
  payoutMinor: r.payout_minor ?? undefined,
  closingPriceDecimal: r.closing_price_decimal ?? undefined,
  notes: r.notes ?? undefined,
  playSnapshot: r.play_snapshot_json
    ? (JSON.parse(r.play_snapshot_json) as PlayCandidate)
    : undefined,
});

export const betsRepo = {
  async list(opts: { status?: BetStatus; limit?: number } = {}): Promise<Bet[]> {
    const db = await getStorage();
    const limit = opts.limit ?? 500;
    const rows = opts.status
      ? await db.select<BetRow>(
          "SELECT * FROM bets WHERE status = ? ORDER BY placed_at DESC LIMIT ?",
          [opts.status, limit],
        )
      : await db.select<BetRow>(
          "SELECT * FROM bets ORDER BY placed_at DESC LIMIT ?",
          [limit],
        );
    return rows.map(rowToBet);
  },

  async get(id: BetId): Promise<Bet | null> {
    const db = await getStorage();
    const rows = await db.select<BetRow>("SELECT * FROM bets WHERE id = ?", [id]);
    return rows[0] ? rowToBet(rows[0]) : null;
  },

  async insert(bet: Bet): Promise<void> {
    const db = await getStorage();
    await db.execute(
      "INSERT INTO bets(id, placed_at, match_id, league_id, market_key, selection_json, price_decimal, book, stake_units, stake_minor, status, settled_at, payout_minor, closing_price_decimal, notes, play_snapshot_json) " +
        "VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        bet.id,
        bet.placedAt,
        bet.matchId,
        bet.leagueId,
        bet.marketKey,
        JSON.stringify(bet.selection),
        bet.priceDecimal,
        bet.book,
        bet.stakeUnits,
        bet.stakeMinor,
        bet.status,
        bet.settledAt ?? null,
        bet.payoutMinor ?? null,
        bet.closingPriceDecimal ?? null,
        bet.notes ?? null,
        bet.playSnapshot ? JSON.stringify(bet.playSnapshot) : null,
      ],
    );
  },

  async settle(opts: {
    id: BetId;
    status: Exclude<BetStatus, "OPEN">;
    payoutMinor: number;
    settledAt?: string;
  }): Promise<void> {
    const db = await getStorage();
    await db.execute(
      "UPDATE bets SET status = ?, payout_minor = ?, settled_at = ? WHERE id = ?",
      [opts.status, opts.payoutMinor, opts.settledAt ?? new Date().toISOString(), opts.id],
    );
  },

  async setClosingPrice(id: BetId, priceDecimal: number): Promise<void> {
    const db = await getStorage();
    await db.execute(
      "UPDATE bets SET closing_price_decimal = ? WHERE id = ?",
      [priceDecimal, id],
    );
  },

  async reopen(id: BetId): Promise<void> {
    const db = await getStorage();
    await db.execute(
      "UPDATE bets SET status = 'OPEN', payout_minor = NULL, settled_at = NULL WHERE id = ?",
      [id],
    );
  },

  async delete(id: BetId): Promise<void> {
    const db = await getStorage();
    await db.execute("DELETE FROM bets WHERE id = ?", [id]);
  },

  async update(bet: Bet): Promise<void> {
    const db = await getStorage();
    await db.execute(
      "UPDATE bets SET match_id = ?, league_id = ?, market_key = ?, selection_json = ?, price_decimal = ?, book = ?, stake_units = ?, stake_minor = ?, notes = ? WHERE id = ?",
      [
        bet.matchId,
        bet.leagueId,
        bet.marketKey,
        JSON.stringify(bet.selection),
        bet.priceDecimal,
        bet.book,
        bet.stakeUnits,
        bet.stakeMinor,
        bet.notes ?? null,
        bet.id,
      ],
    );
  },

  async upsert(bet: Bet): Promise<"inserted" | "updated"> {
    const db = await getStorage();
    const existing = await db.select<{ id: string }>(
      "SELECT id FROM bets WHERE id = ?",
      [bet.id],
    );
    if (existing[0]) {
      await db.execute(
        "UPDATE bets SET placed_at = ?, match_id = ?, league_id = ?, market_key = ?, selection_json = ?, price_decimal = ?, book = ?, stake_units = ?, stake_minor = ?, status = ?, settled_at = ?, payout_minor = ?, closing_price_decimal = ?, notes = ?, play_snapshot_json = ? WHERE id = ?",
        [
          bet.placedAt,
          bet.matchId,
          bet.leagueId,
          bet.marketKey,
          JSON.stringify(bet.selection),
          bet.priceDecimal,
          bet.book,
          bet.stakeUnits,
          bet.stakeMinor,
          bet.status,
          bet.settledAt ?? null,
          bet.payoutMinor ?? null,
          bet.closingPriceDecimal ?? null,
          bet.notes ?? null,
          bet.playSnapshot ? JSON.stringify(bet.playSnapshot) : null,
          bet.id,
        ],
      );
      return "updated";
    }
    await this.insert(bet);
    return "inserted";
  },
};
