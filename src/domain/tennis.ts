// Tennis domain types — data layer for ATP/WTA match analysis.
// Plain interfaces; providers populate these from the shared odds-api.io feed +
// external Elo sources (e.g. Jeff Sackmann's tennis_atp / tennis_wta datasets).
// Surface × Tour is the core split: serve baselines differ materially between
// ATP grass (~0.66 spw) and WTA clay (~0.55 spw), so all stats carry surface context.

export type Surface = "hard" | "clay" | "grass";
export type Tour = "atp" | "wta";

// ---------------------------------------------------------------------------
// Match format
// ---------------------------------------------------------------------------

/** Final-set rules used across tour events.
 *  advantage   — play until two-game lead (Wimbledon, Roland Garros WTA).
 *  tiebreak7   — standard tiebreak at 6-6 (most ATP/WTA events since 2022).
 *  tiebreak10  — match tiebreak at 1-1 sets (some Challengers; US Open 5th set). */
export type FinalSetRule = "advantage" | "tiebreak7" | "tiebreak10";

export interface MatchFormat {
  bestOf: 3 | 5;
  noAd: boolean; // no-advantage scoring (some Challengers/ITF; rare on main tour)
  finalSetRule: FinalSetRule;
}

/**
 * Derive a default MatchFormat from tour and event-level flags.
 * Caller provides overrides when event metadata is available.
 * Safe default for any unlabelled ATP/WTA tour match: BO3, tiebreak7, ad scoring.
 */
export function defaultMatchFormat(
  tour: Tour,
  opts: {
    grandSlam?: boolean; // Grand Slam event (Roland Garros, Wimbledon, US Open, AO)
    wimbledon?: boolean; // Wimbledon specifically (advantage final set)
    noAd?: boolean;      // no-advantage deuce scoring
  } = {}
): MatchFormat {
  const { grandSlam = false, wimbledon = false, noAd = false } = opts;

  if (grandSlam) {
    return {
      bestOf: tour === "atp" ? 5 : 3, // ATP Slams = BO5; WTA = BO3
      noAd,
      finalSetRule: wimbledon ? "advantage" : "tiebreak10",
    };
  }

  // Standard tour match: BO3, tiebreak final set (ATP since 2022 US Open rule change)
  return { bestOf: 3, noAd, finalSetRule: "tiebreak7" };
}

// ---------------------------------------------------------------------------
// Serve / return statistics
// ---------------------------------------------------------------------------

/** Per-surface serve/return split with sample sizes for shrinkage weighting. */
export interface SurfaceSplit {
  spw: number;       // service points won on this surface (0..1)
  rpw: number;       // return points won on this surface (0..1)
  svptSample: number; // service points in sample (drives shrinkage weight)
  rpSample: number;   // return points in sample
  acePct?: number;   // aces / service points (0..1); absent until point-level data sourced
  dfPct?: number;    // double faults / service points (0..1)
}

/**
 * A player's serve and return statistics with surface-specific splits.
 * Overall rates are the primary model inputs; surface splits are applied via
 * shrinkage toward the Surface × Tour baseline from constants.ts.
 * Absent surface key => model uses spwOverall + surface delta adjustment.
 */
export interface PlayerServeStats {
  spwOverall: number;  // all-surface rolling service points won (0..1)
  rpwOverall: number;  // all-surface rolling return points won (0..1)
  surfaceSplits: Partial<Record<Surface, SurfaceSplit>>; // absent surface = use overall + delta
  spwSampleSize: number; // total service points backing spwOverall (drives shrinkage weight)
  rpwSampleSize: number; // total return points backing rpwOverall
  season?: number;       // data vintage year (e.g. 2025); absent = rolling multi-season
}

// ---------------------------------------------------------------------------
// Elo ratings
// ---------------------------------------------------------------------------

/**
 * Elo ratings for a player. Conventional scale (~1500 centre, ~200 SD on tour).
 * Surface-specific Elos are maintained separately and blended at projection time
 * (blend weights in constants.ts ELO_DECAY_HALFLIFE_DAYS / W_SURFACE_ELO).
 */
export interface EloRatings {
  overall: number;                              // overall Elo (all surfaces pooled)
  bySurface: Partial<Record<Surface, number>>;  // surface-specific Elo; absent = use overall
  lastUpdated: string;                          // ISO date "2025-06-30"
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

export interface TennisPlayer {
  playerId: string;            // provider-agnostic string id (odds-api.io participant id)
  name: string;
  tour: Tour;
  elo?: EloRatings;            // absent when Elo data not yet fetched / player not ranked
  serveStats?: PlayerServeStats; // absent when stats not yet fetched for this player
}

// ---------------------------------------------------------------------------
// Match result / settlement (from odds-api.io scores.periods)
// ---------------------------------------------------------------------------

/** A single set score parsed from the feed's `scores.periods` array. */
export interface SetScore {
  playerA: number; // games won by the "home" / first-listed participant
  playerB: number; // games won by the "away" / second-listed participant
}

/**
 * Settled match result parsed from the odds-api.io scores payload.
 * `periodScores` maps period label ("period_1", "period_2", …) to SetScore.
 * `winner` uses "A" / "B" matching participant order in the feed event.
 */
export interface TennisMatchResult {
  eventId: string;                            // odds-api.io event id
  winner: "A" | "B";
  setsA: number;                              // sets won by player A
  setsB: number;
  periodScores: Record<string, SetScore>;     // "period_1" -> { playerA: 6, playerB: 4 }
  settledAt: string;                          // ISO timestamp from feed
}
