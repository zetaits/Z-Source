/**
 * Tunable numeric constants for the tennis match projection model.
 *
 * Single source of truth for every magic number the model uses. Values flagged
 * TODO(calibration) are first-pass estimates from 2024-25 ATP/WTA tour data and
 * are expected to be validated once a backtest harness exists. Keep all model
 * tunables here — no literals in the math modules.
 */

import type { Surface, Tour } from "@/domain/tennis";

// ---------------------------------------------------------------------------
// League serve/return baselines — Surface × Tour
// ---------------------------------------------------------------------------
// spw = probability server wins a service point (0..1).
// rpw = probability returner wins a return point = 1 - opponent spw at league level;
// stored explicitly so callers can apply per-player asymmetries cleanly.
//
// ATP 2024-25 approximate aggregates (ATP Stats, tennis-abstract.com):
//   Hard ~0.640 spw   Clay ~0.620 spw   Grass ~0.660 spw
// WTA 2024-25 approximate aggregates (WTA Stats):
//   Hard ~0.570 spw   Clay ~0.550 spw   Grass ~0.590 spw
// All TODO(calibration): validate against point-level match data once sourced.

export type LeagueServeBaseline = { readonly spw: number; readonly rpw: number };
export type LeagueServeBaselines = {
  readonly [T in Tour]: { readonly [S in Surface]: LeagueServeBaseline };
};

export const LEAGUE_BASELINES: LeagueServeBaselines = {
  atp: {
    hard:  { spw: 0.640, rpw: 0.360 }, // ATP hard 2024-25. TODO(calibration)
    clay:  { spw: 0.620, rpw: 0.380 }, // Clay: more break opportunities. TODO(calibration)
    grass: { spw: 0.660, rpw: 0.340 }, // Grass: fastest surface; serve dominates. TODO(calibration)
  },
  wta: {
    hard:  { spw: 0.570, rpw: 0.430 }, // WTA hard: materially more breaks than ATP. TODO(calibration)
    clay:  { spw: 0.550, rpw: 0.450 }, // WTA clay: highest break rate on tour. TODO(calibration)
    grass: { spw: 0.590, rpw: 0.410 }, // WTA grass: serve-heavy but still below ATP. TODO(calibration)
  },
} as const;

// ---------------------------------------------------------------------------
// Surface-sample shrinkage (analog of baseball K_SHRINK_PA)
// ---------------------------------------------------------------------------
// Regress a player's surface-specific spw toward the surface prior:
//   spw_surface_shrunk = (surfaceSvpt * spw_surface + SPW_SHRINK_SVPT * prior)
//                        / (surfaceSvpt + SPW_SHRINK_SVPT)
// where prior = spwOverall + SURFACE_DELTA[surface].
// 200 ≈ roughly one full-surface season of service points for a top player;
// regresses hard early-career / surface-sparse stats aggressively.
// TODO(calibration): grid 100-400 based on surface-split variance analysis.

export const SPW_SHRINK_SVPT = 200; // pseudo service-point prior weight. TODO(calibration)
export const RPW_SHRINK_RP   = 200; // pseudo return-point prior weight. TODO(calibration)

// ---------------------------------------------------------------------------
// Surface adjustment deltas — overall → surface prior
// ---------------------------------------------------------------------------
// When a player has no surface-specific data, the model uses:
//   spw_prior = spwOverall + SURFACE_DELTA[surface]
// Derived directionally from LEAGUE_BASELINES (clay harder to hold than hard;
// grass easier). Values are symmetric across tours as a first pass.
// TODO(calibration): fit per-tour surface regression once data is sourced.

export const ATP_SURFACE_DELTA: Readonly<Record<Surface, number>> = {
  hard:  +0.000, // reference surface for ATP
  clay:  -0.020, // holding serve harder on clay: -2pp vs hard. TODO(calibration)
  grass: +0.020, // holding serve easier on grass: +2pp vs hard. TODO(calibration)
};

export const WTA_SURFACE_DELTA: Readonly<Record<Surface, number>> = {
  hard:  +0.000, // reference surface for WTA
  clay:  -0.020, // consistent with ATP directionality. TODO(calibration)
  grass: +0.020, // TODO(calibration)
};

// ---------------------------------------------------------------------------
// Elo time-decay and surface-blend weights
// ---------------------------------------------------------------------------

// Rolling half-life for Elo time-decay: older matches receive weight
// proportional to exp(-k * daysSinceMatch) where k = ln(2) / halflife.
// 365 days = mild decay; tour has 50-60 matches/year so recency matters.
// TODO(calibration): consider 180-365 depending on surface-transition variance.
export const ELO_DECAY_HALFLIFE_DAYS = 365; // TODO(calibration)

// Standard Elo expected-score divisor: E(A) = 1 / (1 + 10^((eloB - eloA) / ELO_DIVISOR)).
// 400 is the conventional choice (matches chess Elo; tennis-abstract.com uses same scale).
export const ELO_DIVISOR = 400;

// Blend surface Elo with overall:
//   eloBlended = W_SURFACE_ELO * eloSurface + (1 - W_SURFACE_ELO) * eloOverall
// Falls back to overall when surface match count < ELO_SURFACE_MIN_MATCHES.
export const W_SURFACE_ELO = 0.60; // TODO(calibration): grid 0.5-0.8 by surface sample depth
export const ELO_SURFACE_MIN_MATCHES = 15; // matches needed before surface Elo is trusted. TODO(calibration)

// ---------------------------------------------------------------------------
// Confidence penalties (multiplicative, same pattern as baseball model)
// ---------------------------------------------------------------------------

export const CONF_BASE_FULL         = 0.90; // all inputs present
export const CONF_NO_SERVE_STATS    = 0.70; // serve/return stats absent — major gap. TODO(calibration)
export const CONF_NO_SURFACE_SPLIT  = 0.85; // surface-specific split absent; overall + delta used
export const CONF_NO_ELO            = 0.80; // Elo absent; win prob from serve model only. TODO(calibration)

// ---------------------------------------------------------------------------
// EV and bet thresholds (mirrored from baseball analyze.ts)
// ---------------------------------------------------------------------------

export const EV_THRESHOLD        = 0.05; // 5% min edge to emit a play (conservative v1)
export const STRONG_EV_THRESHOLD = 0.10; // PLAY when EV >= this, else LEAN
export const MIN_CONFIDENCE      = 0.45; // model confidence floor; below this = no play

// ---------------------------------------------------------------------------
// Probability clamps
// ---------------------------------------------------------------------------

export const P_EPS        = 1e-6; // clamp probabilities into [P_EPS, 1 - P_EPS]
export const P_TALENT_MIN = 0.30; // floor for player spw after adjustments (WTA clay worst case)
export const P_TALENT_MAX = 0.80; // ceiling for player spw (fast-grass big servers)
