/**
 * Tennis model layer — public surface.
 *
 * `projectMatch` is the one entry point analyze.ts calls. It wires the two-layer
 * rating design end to end:
 *   1. resolveServeParams  → baseline-consistent (spwA, spwB) from serve stats.
 *   2. Elo anchor          → if both players have Elo, compute the surface-blended
 *                            Elo win prob and RECONCILE the serve spread to it.
 *                            Elo decides who wins; serve stats decide how games
 *                            distribute (combined dominance is held fixed).
 *   3. projectMatchProbabilities → P(win), set-score + total-games distributions.
 *   4. confidence/tier     → degradation grading (full / partial / low).
 *
 * Pure and deterministic over its domain inputs.
 */
import { clamp } from "@/engine/ev";
import {
  CONF_BASE_FULL,
  CONF_NO_ELO,
  CONF_NO_SERVE_STATS,
  CONF_NO_SURFACE_SPLIT,
  ELO_DIVISOR,
  P_EPS,
  W_SURFACE_ELO,
} from "./constants";
import { projectMatchProbabilities, reconcileSpwToMatchProb } from "./hierarchy";
import { blendSurfaceElo, resolveServeParams } from "./serve";
import type {
  MatchProjection,
  MatchProjectionInputsUsed,
  ProjectMatchArgs,
  TennisTier,
} from "./types";

export * from "./hierarchy";
export * from "./serve";
export type * from "./types";

// Below this the projection carries effectively no real data (no Elo and at most
// one player's stats): force confidence under the bet floor so analyze() bails.
const CONF_NO_DATA = 0.4;

/** Grade tier + confidence from what data actually backed the projection. */
const gradeConfidence = (
  bothHaveStats: boolean,
  surfaceSplitAvailable: boolean,
  eloAvailable: boolean,
): { tier: TennisTier; confidence: number } => {
  if (bothHaveStats && surfaceSplitAvailable && eloAvailable)
    return { tier: "full", confidence: CONF_BASE_FULL };
  if (bothHaveStats && eloAvailable)
    return { tier: "full", confidence: CONF_NO_SURFACE_SPLIT };
  // Elo present but serve stats incomplete: ML is Elo-driven and trustworthy;
  // games distribution rests on league serve baselines, so confidence is reduced.
  if (eloAvailable) return { tier: "partial", confidence: CONF_NO_SERVE_STATS };
  // Serve stats present but no Elo: the serve model carries the win prob alone.
  if (bothHaveStats) return { tier: "partial", confidence: CONF_NO_ELO };
  return { tier: "low", confidence: CONF_NO_DATA };
};

export const projectMatch = (args: ProjectMatchArgs): MatchProjection => {
  const { playerA, playerB, surface, format } = args;
  const tour = playerA.tour;

  const resolved = resolveServeParams({ playerA, playerB, surface, tour });
  let params = resolved.params;

  // Elo anchor. Prefer an explicitly supplied eloWinProbA; else derive from the
  // surface-blended Elo of both players.
  const eloA = blendSurfaceElo(playerA, surface, W_SURFACE_ELO);
  const eloB = blendSurfaceElo(playerB, surface, W_SURFACE_ELO);
  const eloAvailable = eloA !== undefined && eloB !== undefined;

  let eloWinProbA = args.eloWinProbA;
  if (eloWinProbA === undefined && eloAvailable) {
    eloWinProbA = 1 / (1 + 10 ** (((eloB as number) - (eloA as number)) / ELO_DIVISOR));
  }
  if (eloWinProbA !== undefined) {
    params = reconcileSpwToMatchProb(params, clamp(eloWinProbA, P_EPS, 1 - P_EPS), format);
  }

  const probs = projectMatchProbabilities(params, format);
  const { tier, confidence } = gradeConfidence(
    resolved.bothHaveStats,
    resolved.surfaceSplitAvailable,
    eloWinProbA !== undefined,
  );

  const inputsUsed: MatchProjectionInputsUsed = {
    tier,
    surface,
    tour,
    format,
    serveParamsSource: resolved.source,
    eloAvailable: eloWinProbA !== undefined,
    surfaceSplitAvailable: resolved.surfaceSplitAvailable,
    spwA: params.spwA,
    spwB: params.spwB,
    eloA,
    eloB,
  };

  return {
    pMatchWin: probs.pMatchWin,
    setScoreDistribution: probs.setScoreDistribution,
    gamesDistribution: probs.gamesDistribution,
    confidence,
    tier,
    inputsUsed,
  };
};
