/**
 * Pitcher strikeout projection — pure model layer (Phase 2).
 * Re-exports the public surface: the orchestrator, its types, and the numeric
 * primitives (handy for tests and Phase-3 wiring). No I/O, no odds, no UI.
 */
export { projectStrikeouts } from "./kProjection";
export {
  log5K,
  poissonBinomialPmf,
  bfPoissonDistribution,
  mixStrikeoutPmf,
  pmfMean,
  tailOver,
} from "./poissonBinomial";
export type {
  KProjection,
  KProjectionInputsUsed,
  KProjectionTier,
  ProjectStrikeoutsArgs,
  SavantSource,
} from "./types";
