import type { MarketKey } from "@/domain/market";
import type { Verdict } from "@/domain/play";
import type { StrategyConfig } from "@/domain/strategy";
import { runBondedAnalysis } from "@/engine";
import { historicalOddsRepo, type HistoricalMatch } from "@/storage/repos/historicalOddsRepo";
import { buildBacktestContext } from "./contextBuilder";
import { resolvePlayOutcome, type BacktestOutcome } from "./outcomeResolver";

export interface BacktestRow {
  matchId: string;
  date: string;
  league: string;
  selectionKey: string;
  marketKey: MarketKey;
  verdict: Verdict;
  edgePct: number;
  fairProb: number;
  confidence: number;
  priceDecimal: number;
  stakeUnits: number;
  outcome: BacktestOutcome;
  payoutUnits: number;
}

export interface VerdictMarketAgg {
  verdict: Verdict;
  marketKey: MarketKey;
  n: number;
  wins: number;
  losses: number;
  pushes: number;
  hitRate: number;
  totalStake: number;
  totalPayout: number;
  roi: number;
}

export interface BacktestSummary {
  totalMatches: number;
  matchesAnalysed: number;
  totalPicks: number;
  perVerdictMarket: VerdictMarketAgg[];
}

export interface RunBacktestOpts {
  league: string;
  season?: string;
  strategy: StrategyConfig;
  onProgress?: (done: number, total: number) => void;
  abortSignal?: AbortSignal;
}

export const runBacktest = async (
  opts: RunBacktestOpts,
): Promise<{ rows: BacktestRow[]; summary: BacktestSummary }> => {
  const matches = await historicalOddsRepo.listMatches({
    league: opts.league,
    season: opts.season,
  });
  const rows: BacktestRow[] = [];
  let matchesAnalysed = 0;

  for (let i = 0; i < matches.length; i++) {
    if (opts.abortSignal?.aborted) break;
    const match: HistoricalMatch = matches[i];
    const priorMatches = matches.slice(0, i);

    try {
      const ctx = await buildBacktestContext({
        match,
        priorMatches,
        strategy: opts.strategy,
      });
      const { candidates } = runBondedAnalysis(ctx, { includePass: false });
      for (const c of candidates) {
        const res = resolvePlayOutcome(c, match.fthg, match.ftag);
        rows.push({
          matchId: match.id,
          date: match.date,
          league: match.league,
          selectionKey: `${c.selection.marketKey}:${c.selection.side}${c.selection.line !== undefined ? `@${c.selection.line}` : ""}`,
          marketKey: c.selection.marketKey,
          verdict: c.verdict,
          edgePct: c.edgePct,
          fairProb: c.fairProb,
          confidence: c.confidence,
          priceDecimal: c.price.decimal,
          stakeUnits: Math.max(c.stakeUnits, 1),
          outcome: res.outcome,
          payoutUnits: res.payoutUnits,
        });
      }
      matchesAnalysed++;
    } catch {
      // Skip match on context build failure
    }

    if (opts.onProgress && i % 25 === 0) opts.onProgress(i + 1, matches.length);
  }
  if (opts.onProgress) opts.onProgress(matches.length, matches.length);

  const summary = aggregate(rows, matches.length, matchesAnalysed);
  return { rows, summary };
};

const aggregate = (
  rows: BacktestRow[],
  totalMatches: number,
  matchesAnalysed: number,
): BacktestSummary => {
  const map = new Map<string, VerdictMarketAgg>();
  for (const r of rows) {
    const key = `${r.verdict}:${r.marketKey}`;
    let agg = map.get(key);
    if (!agg) {
      agg = {
        verdict: r.verdict,
        marketKey: r.marketKey,
        n: 0,
        wins: 0,
        losses: 0,
        pushes: 0,
        hitRate: 0,
        totalStake: 0,
        totalPayout: 0,
        roi: 0,
      };
      map.set(key, agg);
    }
    agg.n++;
    if (r.outcome === "WIN") agg.wins++;
    else if (r.outcome === "LOSS") agg.losses++;
    else if (r.outcome === "PUSH") agg.pushes++;
    agg.totalStake += r.stakeUnits;
    agg.totalPayout += r.payoutUnits;
  }
  for (const agg of map.values()) {
    const decisive = agg.wins + agg.losses;
    agg.hitRate = decisive > 0 ? agg.wins / decisive : 0;
    agg.roi =
      agg.totalStake > 0
        ? (agg.totalPayout - agg.totalStake) / agg.totalStake
        : 0;
  }
  return {
    totalMatches,
    matchesAnalysed,
    totalPicks: rows.length,
    perVerdictMarket: Array.from(map.values()).sort(
      (a, b) => b.n - a.n,
    ),
  };
};
