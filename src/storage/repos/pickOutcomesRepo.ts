import { BetId, LeagueId, MatchId, PlayId } from "@/domain/ids";
import type { MarketKey, Selection } from "@/domain/market";
import type { PlayCandidate, Verdict } from "@/domain/play";
import { getStorage } from "@/storage";

export type PickOutcomeStatus = "PENDING" | "WIN" | "LOSS" | "PUSH" | "VOID";

export interface PickOutcome {
  playId: PlayId;
  generatedAt: string;
  matchId: MatchId;
  leagueId?: LeagueId;
  marketKey: MarketKey;
  selection: Selection;
  verdict: Verdict;
  edgePct: number;
  fairProb: number;
  confidence: number;
  priceDecimal: number;
  stakeUnits: number;
  outcome: PickOutcomeStatus;
  payoutUnits?: number;
  settledAt?: string;
  betId?: BetId;
}

interface Row {
  play_id: string;
  generated_at: string;
  match_id: string;
  league_id: string | null;
  market_key: MarketKey;
  selection_json: string;
  verdict: Verdict;
  edge_pct: number;
  fair_prob: number;
  confidence: number;
  price_decimal: number;
  stake_units: number;
  outcome: PickOutcomeStatus;
  payout_units: number | null;
  settled_at: string | null;
  bet_id: string | null;
}

const rowToOutcome = (r: Row): PickOutcome => ({
  playId: PlayId(r.play_id),
  generatedAt: r.generated_at,
  matchId: MatchId(r.match_id),
  leagueId: r.league_id ? LeagueId(r.league_id) : undefined,
  marketKey: r.market_key,
  selection: JSON.parse(r.selection_json) as Selection,
  verdict: r.verdict,
  edgePct: r.edge_pct,
  fairProb: r.fair_prob,
  confidence: r.confidence,
  priceDecimal: r.price_decimal,
  stakeUnits: r.stake_units,
  outcome: r.outcome,
  payoutUnits: r.payout_units ?? undefined,
  settledAt: r.settled_at ?? undefined,
  betId: r.bet_id ? BetId(r.bet_id) : undefined,
});

export interface VerdictMarketSummary {
  verdict: Verdict;
  marketKey: MarketKey;
  total: number;
  settled: number;
  wins: number;
  losses: number;
  pushes: number;
  hitRate: number;
  roi: number;
}

export interface CalibrationBin {
  binLo: number;
  binHi: number;
  n: number;
  predictedAvg: number;
  realisedRate: number;
}

const buildBins = (count: number): Array<[number, number]> => {
  const bins: Array<[number, number]> = [];
  for (let i = 0; i < count; i++) {
    bins.push([i / count, (i + 1) / count]);
  }
  return bins;
};

export const pickOutcomesRepo = {
  async insertFromPlay(
    play: PlayCandidate,
    leagueId?: LeagueId,
    betId?: BetId,
  ): Promise<void> {
    const db = await getStorage();
    await db.execute(
      "INSERT OR REPLACE INTO pick_outcomes(play_id, generated_at, match_id, league_id, market_key, selection_json, verdict, edge_pct, fair_prob, confidence, price_decimal, stake_units, outcome, payout_units, settled_at, bet_id) " +
        "VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT outcome FROM pick_outcomes WHERE play_id = ?), 'PENDING'), (SELECT payout_units FROM pick_outcomes WHERE play_id = ?), (SELECT settled_at FROM pick_outcomes WHERE play_id = ?), ?)",
      [
        play.id,
        play.generatedAt,
        play.matchId,
        leagueId ?? null,
        play.selection.marketKey,
        JSON.stringify(play.selection),
        play.verdict,
        play.edgePct,
        play.fairProb,
        play.confidence,
        play.price.decimal,
        play.stakeUnits,
        play.id,
        play.id,
        play.id,
        betId ?? null,
      ],
    );
  },

  async get(playId: PlayId): Promise<PickOutcome | null> {
    const db = await getStorage();
    const rows = await db.select<Row>(
      "SELECT * FROM pick_outcomes WHERE play_id = ?",
      [playId],
    );
    return rows[0] ? rowToOutcome(rows[0]) : null;
  },

  async list(opts: { limit?: number; outcome?: PickOutcomeStatus } = {}): Promise<PickOutcome[]> {
    const db = await getStorage();
    const limit = opts.limit ?? 1000;
    const rows = opts.outcome
      ? await db.select<Row>(
          "SELECT * FROM pick_outcomes WHERE outcome = ? ORDER BY generated_at DESC LIMIT ?",
          [opts.outcome, limit],
        )
      : await db.select<Row>(
          "SELECT * FROM pick_outcomes ORDER BY generated_at DESC LIMIT ?",
          [limit],
        );
    return rows.map(rowToOutcome);
  },

  async markOutcome(
    playId: PlayId,
    outcome: PickOutcomeStatus,
    payoutUnits?: number,
    settledAt?: string,
  ): Promise<void> {
    const db = await getStorage();
    await db.execute(
      "UPDATE pick_outcomes SET outcome = ?, payout_units = ?, settled_at = ? WHERE play_id = ?",
      [
        outcome,
        payoutUnits ?? null,
        settledAt ?? new Date().toISOString(),
        playId,
      ],
    );
  },

  async linkBet(playId: PlayId, betId: BetId): Promise<void> {
    const db = await getStorage();
    await db.execute(
      "UPDATE pick_outcomes SET bet_id = ? WHERE play_id = ?",
      [betId, playId],
    );
  },

  async mirrorFromBet(
    betId: BetId,
    outcome: PickOutcomeStatus,
    payoutUnits?: number,
    settledAt?: string,
  ): Promise<void> {
    const db = await getStorage();
    await db.execute(
      "UPDATE pick_outcomes SET outcome = ?, payout_units = ?, settled_at = ? WHERE bet_id = ?",
      [
        outcome,
        payoutUnits ?? null,
        settledAt ?? new Date().toISOString(),
        betId,
      ],
    );
  },

  async summaryByVerdictMarket(): Promise<VerdictMarketSummary[]> {
    const db = await getStorage();
    const rows = await db.select<{
      verdict: Verdict;
      market_key: MarketKey;
      total: number;
      settled: number;
      wins: number;
      losses: number;
      pushes: number;
      sum_stake: number;
      sum_payout: number;
    }>(
      "SELECT verdict, market_key, " +
        "COUNT(*) AS total, " +
        "SUM(CASE WHEN outcome IN ('WIN','LOSS','PUSH','VOID') THEN 1 ELSE 0 END) AS settled, " +
        "SUM(CASE WHEN outcome = 'WIN' THEN 1 ELSE 0 END) AS wins, " +
        "SUM(CASE WHEN outcome = 'LOSS' THEN 1 ELSE 0 END) AS losses, " +
        "SUM(CASE WHEN outcome = 'PUSH' THEN 1 ELSE 0 END) AS pushes, " +
        "COALESCE(SUM(CASE WHEN outcome IN ('WIN','LOSS','PUSH') THEN stake_units ELSE 0 END), 0) AS sum_stake, " +
        "COALESCE(SUM(CASE WHEN outcome IN ('WIN','LOSS','PUSH') THEN payout_units ELSE 0 END), 0) AS sum_payout " +
        "FROM pick_outcomes GROUP BY verdict, market_key",
    );
    return rows.map((r) => {
      const decisive = r.wins + r.losses;
      const hitRate = decisive > 0 ? r.wins / decisive : 0;
      const roi = r.sum_stake > 0 ? (r.sum_payout - r.sum_stake) / r.sum_stake : 0;
      return {
        verdict: r.verdict,
        marketKey: r.market_key,
        total: r.total,
        settled: r.settled,
        wins: r.wins,
        losses: r.losses,
        pushes: r.pushes,
        hitRate,
        roi,
      };
    });
  },

  async calibrationData(binCount = 10): Promise<CalibrationBin[]> {
    const db = await getStorage();
    const rows = await db.select<{ fair_prob: number; outcome: PickOutcomeStatus }>(
      "SELECT fair_prob, outcome FROM pick_outcomes WHERE outcome IN ('WIN','LOSS')",
    );
    const bins = buildBins(binCount);
    return bins.map(([lo, hi]) => {
      const inBin = rows.filter((r) => r.fair_prob >= lo && r.fair_prob < hi);
      const n = inBin.length;
      const wins = inBin.filter((r) => r.outcome === "WIN").length;
      const predictedAvg =
        n > 0 ? inBin.reduce((s, r) => s + r.fair_prob, 0) / n : (lo + hi) / 2;
      const realisedRate = n > 0 ? wins / n : 0;
      return { binLo: lo, binHi: hi, n, predictedAvg, realisedRate };
    });
  },

  async delete(playId: PlayId): Promise<void> {
    const db = await getStorage();
    await db.execute("DELETE FROM pick_outcomes WHERE play_id = ?", [playId]);
  },
};
