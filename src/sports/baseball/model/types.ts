/**
 * Public input/output shapes for the pitcher strikeout projection model.
 * All inputs are Phase-1 domain objects from `@/domain/baseball`; the model is
 * pure and deterministic over them.
 */
import type {
  BatterKSplits,
  Handedness,
  LineupSlot,
  PitcherGameLog,
  PitcherSeasonStats,
  SavantPitcherProfile,
} from "@/domain/baseball";

/** Degradation tier reflecting how much real data backed the projection. */
export type KProjectionTier = "full" | "partial" | "low";

/** Which Savant "stuff" signal fed the pitcher K-talent blend. */
export type SavantSource = "swstr" | "csw" | "none";

/** Provenance / diagnostics for a single projection (no odds, no EV). */
export interface KProjectionInputsUsed {
  tier: KProjectionTier;
  pitcherTalentK: number; // P pre-platoon (blended season + stuff)
  leagueK: number;
  bfMean: number;
  usedMarketOutsLine: boolean;
  /** Outing length had a real signal (Outs O/U line or recent starts). When
   * false, BF is a generic default and confidence is forced below the bet floor. */
  bfAnchored: boolean;
  savantSource: SavantSource;
  lineupConfirmed: boolean;
  battersModeled: number;
}

/** Output of `projectStrikeouts`. `pmf` index = K count; `pmf` sums ~1. */
export interface KProjection {
  expectedKs: number;
  pmf: number[];
  /** Tail probability P(K > line); strict-greater handles .5 lines and excludes pushes. */
  pOver: (line: number) => number;
  confidence: number; // 0..1
  inputsUsed: KProjectionInputsUsed;
}

/** Arguments to `projectStrikeouts`. Phase 3 supplies `marketOutsLine`; the model never fetches it. */
export interface ProjectStrikeoutsArgs {
  pitcher: PitcherSeasonStats;
  throws: Handedness; // from ProbablePitcher.throws; caller must resolve before calling
  gamelogs: PitcherGameLog[];
  savant?: SavantPitcherProfile;
  opponentLineup: LineupSlot[]; // [] when unconfirmed -> partial tier
  batterSplits: Record<number, BatterKSplits>; // playerId -> splits
  marketOutsLine?: number; // Pitcher Outs O/U line; optional, never fetched here
}
