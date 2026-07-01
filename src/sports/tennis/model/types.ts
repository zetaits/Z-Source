/**
 * Public input/output shapes for the tennis match projection model.
 * All inputs are domain objects from `@/domain/tennis`; the model is
 * pure and deterministic over them.
 */
import type { MatchFormat, Surface, TennisPlayer, Tour } from "@/domain/tennis";

// ---------------------------------------------------------------------------
// Serve parameter bundle — resolved inputs fed to the point-level Markov chain
// ---------------------------------------------------------------------------

/**
 * Resolved serve-win probabilities for both players on a specific surface.
 * These are the primary numeric inputs to the game/set/match probability recursion.
 * Produced by the serve resolver (src/sports/tennis/model/serve.ts); not set by callers.
 */
export interface ServeParams {
  spwA: number; // P(A wins service point when A serves) — surface-shrunk (0..1)
  spwB: number; // P(B wins service point when B serves) — surface-shrunk (0..1)
}

// ---------------------------------------------------------------------------
// Projection tier
// ---------------------------------------------------------------------------

/** Degradation tier reflecting how much real data backed the projection.
 *  Mirrors KProjectionTier in baseball model. */
export type TennisTier = "full" | "partial" | "low";

// ---------------------------------------------------------------------------
// Score distributions
// ---------------------------------------------------------------------------

/**
 * Sparse probability mass over discrete score strings.
 * Keys use canonical "A-B" notation: games within a set ("6-4", "7-5", "7-6"),
 * or sets within a match ("2-0", "2-1", "0-2", "1-2").
 * Absent keys have probability effectively zero.
 */
export type ScoreDistribution = Record<string, number>;

// ---------------------------------------------------------------------------
// Provenance / diagnostics
// ---------------------------------------------------------------------------

/** How the serve parameters spwA/spwB were derived. */
export type ServeParamsSource =
  | "stats+surface" // player has surface-specific stats; shrunk to surface baseline
  | "stats+delta"   // player has overall stats only; overall + surface delta used as prior
  | "league-only";  // no player stats at all; league baseline used directly

/** Provenance diagnostics for a single match projection (no odds, no EV). */
export interface MatchProjectionInputsUsed {
  tier: TennisTier;
  surface: Surface;
  tour: Tour;
  format: MatchFormat;
  serveParamsSource: ServeParamsSource; // how spwA/spwB were derived
  eloAvailable: boolean;                // Elo ratings present for both players
  surfaceSplitAvailable: boolean;       // at least one player has surface-specific stats
  spwA: number;                         // resolved value fed to the model (after shrinkage)
  spwB: number;
  eloA?: number;                        // blended Elo used (overall or surface-blended)
  eloB?: number;
}

// ---------------------------------------------------------------------------
// Match projection — model output
// ---------------------------------------------------------------------------

/**
 * Output of the tennis match projection model.
 * `pMatchWin` is P(player A wins the match).
 * Distributions are sparse ScoreDistribution maps; absent keys have ~0 probability.
 */
export interface MatchProjection {
  pMatchWin: number;                         // P(A wins match) — 0..1
  setScoreDistribution: ScoreDistribution;   // e.g. { "2-0": 0.42, "2-1": 0.28, "0-2": 0.19, "1-2": 0.11 }
  gamesDistribution?: ScoreDistribution;     // per-set detailed breakdown (optional for v1)
  confidence: number;                        // 0..1 composite confidence
  tier: TennisTier;
  inputsUsed: MatchProjectionInputsUsed;
}

// ---------------------------------------------------------------------------
// Model input bundles
// ---------------------------------------------------------------------------

/**
 * Arguments to the top-level match projection function.
 * `surface` and `format` are resolved by the caller from event metadata.
 * The model never fetches external data.
 */
export interface ProjectMatchArgs {
  playerA: TennisPlayer;
  playerB: TennisPlayer;
  surface: Surface;
  format: MatchFormat;
  /** Optional Elo-derived pre-match win probability as a blend / sanity-check signal. */
  eloWinProbA?: number; // P(A wins) from pure Elo; absent = serve-model only
  /**
   * Whether player A serves first in the match. Affects tiebreak serve order
   * and total-games distribution (server parity flips each set). Absent = treat
   * as unknown; caller passes when feed provides it, else model assumes A serves first.
   */
  firstServerA?: boolean;
}

/**
 * Arguments to the serve-parameter resolver (separate pure step).
 * Resolves raw player stats + surface context to the ServeParams fed to the Markov chain.
 */
export interface ResolveServeParamsArgs {
  playerA: TennisPlayer;
  playerB: TennisPlayer;
  surface: Surface;
  tour: Tour;
}
