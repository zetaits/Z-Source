/**
 * Serve-parameter resolver — turns raw player serve/return stats into the two
 * per-point serve-win probabilities (spwA, spwB) the Markov hierarchy consumes.
 *
 * Two ideas, both standard pro practice:
 *  1. Surface shrinkage. A player's surface-specific serve% is regressed toward a
 *     prior (their overall rate + a surface delta) with a pseudo-count weight, so
 *     a thin clay sample doesn't dominate. Analog of the baseball K_SHRINK_PA pass.
 *  2. Matchup interaction (Barnett–Clarke / O'Malley). A's effective serve-win
 *     prob is the surface baseline plus A's serve edge over baseline MINUS B's
 *     return edge over baseline:
 *        spwA_eff = base.spw + (spwA_res − base.spw) − (rpwB_res − base.rpw)
 *     i.e. you only beat the average server as much as the opponent fails to
 *     return better than average. This keeps serve talent and return talent on
 *     separate ledgers (no double counting).
 *
 * Pure and deterministic. No Elo here — Elo reconciliation happens one layer up
 * (model/index.ts) on top of these baseline-consistent serve params.
 */
import { clamp } from "@/engine/ev";
import type { PlayerServeStats, Surface, TennisPlayer, Tour } from "@/domain/tennis";
import {
  ATP_SURFACE_DELTA,
  LEAGUE_BASELINES,
  P_TALENT_MAX,
  P_TALENT_MIN,
  RPW_SHRINK_RP,
  SPW_SHRINK_SVPT,
  WTA_SURFACE_DELTA,
} from "./constants";
import type { ResolveServeParamsArgs, ServeParams, ServeParamsSource } from "./types";

/** Resolved single-player rates on the match surface, with provenance flags. */
interface PlayerRates {
  spw: number; // surface-resolved service points won (0..1)
  rpw: number; // surface-resolved return points won (0..1)
  hasStats: boolean;        // player carried any serve stats at all
  usedSurfaceSplit: boolean; // a surface-specific split backed the resolve
}

const surfaceDelta = (tour: Tour, surface: Surface): number =>
  (tour === "wta" ? WTA_SURFACE_DELTA : ATP_SURFACE_DELTA)[surface];

/**
 * Resolve one player's (spw, rpw) on the surface. With no stats we return the
 * league baseline (the player is "average" until proven otherwise); with overall
 * stats only we use overall + surface delta as the prior; with a surface split we
 * shrink that split toward the prior by sample size.
 */
const resolvePlayerRates = (
  stats: PlayerServeStats | undefined,
  surface: Surface,
  tour: Tour,
): PlayerRates => {
  const base = LEAGUE_BASELINES[tour][surface];
  if (!stats) {
    return { spw: base.spw, rpw: base.rpw, hasStats: false, usedSurfaceSplit: false };
  }
  const delta = surfaceDelta(tour, surface);
  // Serve gets +delta on faster surfaces; return mirrors it (−delta): a surface
  // that helps servers hurts returners by the same first-order amount.
  const spwPrior = stats.spwOverall + delta;
  const rpwPrior = stats.rpwOverall - delta;

  const split = stats.surfaceSplits[surface];
  if (split && split.svptSample > 0) {
    const spw =
      (split.svptSample * split.spw + SPW_SHRINK_SVPT * spwPrior) /
      (split.svptSample + SPW_SHRINK_SVPT);
    const rpw =
      (split.rpSample * split.rpw + RPW_SHRINK_RP * rpwPrior) /
      (split.rpSample + RPW_SHRINK_RP);
    return { spw, rpw, hasStats: true, usedSurfaceSplit: true };
  }
  return { spw: spwPrior, rpw: rpwPrior, hasStats: true, usedSurfaceSplit: false };
};

/** Output of the resolver: the serve params plus how they were derived. */
export interface ResolvedServeParams {
  params: ServeParams;
  source: ServeParamsSource;
  surfaceSplitAvailable: boolean;
  /** Both players carried at least overall serve stats. */
  bothHaveStats: boolean;
}

/**
 * Resolve baseline-consistent serve params for the matchup. The interaction is
 * applied symmetrically; results are clamped into the plausible talent band so a
 * pathological stat line can't push a serve prob to 0/1.
 */
export const resolveServeParams = (args: ResolveServeParamsArgs): ResolvedServeParams => {
  const { playerA, playerB, surface, tour } = args;
  const base = LEAGUE_BASELINES[tour][surface];

  const rA = resolvePlayerRates(playerA.serveStats, surface, tour);
  const rB = resolvePlayerRates(playerB.serveStats, surface, tour);

  // Barnett–Clarke matchup interaction on serve points.
  const spwA = clamp(
    base.spw + (rA.spw - base.spw) - (rB.rpw - base.rpw),
    P_TALENT_MIN,
    P_TALENT_MAX,
  );
  const spwB = clamp(
    base.spw + (rB.spw - base.spw) - (rA.rpw - base.rpw),
    P_TALENT_MIN,
    P_TALENT_MAX,
  );

  const bothHaveStats = rA.hasStats && rB.hasStats;
  const surfaceSplitAvailable = rA.usedSurfaceSplit || rB.usedSurfaceSplit;
  const source: ServeParamsSource = !rA.hasStats && !rB.hasStats
    ? "league-only"
    : bothHaveStats && rA.usedSurfaceSplit && rB.usedSurfaceSplit
      ? "stats+surface"
      : "stats+delta";

  return { params: { spwA, spwB }, source, surfaceSplitAvailable, bothHaveStats };
};

/** Resolve a player's surface-blended Elo, or undefined when no Elo is present. */
export const blendSurfaceElo = (
  player: TennisPlayer,
  surface: Surface,
  wSurface: number,
): number | undefined => {
  const elo = player.elo;
  if (!elo) return undefined;
  const surf = elo.bySurface[surface];
  if (surf === undefined) return elo.overall;
  return wSurface * surf + (1 - wSurface) * elo.overall;
};
