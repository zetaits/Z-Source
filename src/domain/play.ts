import type { MatchId, PlayId } from "./ids";
import type { Selection } from "./market";
import type { Price } from "./odds";
import type { ReasoningEntry } from "./trace";

export type Verdict = "PASS" | "LEAN" | "PLAY" | "STRONG";

export interface PlayCandidate {
  id: PlayId;
  matchId: MatchId;
  selection: Selection;
  price: Price;
  edgePct: number;
  fairProb: number;
  confidence: number;
  stakeUnits: number;
  verdict: Verdict;
  trace: ReasoningEntry[];
  generatedAt: string;
  /**
   * Optional hint for auto-settling from the source feed (e.g. MLB statsapi).
   * matchId is the odds-provider event id, which can't address the box score —
   * this carries the native ids needed to fetch the realised result. Set by the
   * baseball module only; football leaves it undefined.
   */
  settleRef?: SettleRef;
}

/** Native source-feed ids for auto-settling a prop bet. */
export interface SettleRef {
  /** MLB statsapi gamePk. */
  gamePk: number;
  /** statsapi player id of the prop subject (pitcher). */
  playerId: number;
  /** Game date (YYYY-MM-DD) for the schedule lookup. */
  date: string;
}

export interface ComboLeg {
  selection: Selection;
  fairProb: number;
  priceDecimal: number;
  baseSelectionId: PlayId;
}

export type ComboType = "VALUE" | "ANCHOR";

export interface ComboPlay {
  id: PlayId;
  matchId: MatchId;
  legs: ComboLeg[];
  combinedDecimal: number;
  combinedFairProb: number;
  edgePct: number;
  confidence: number;
  verdict: Verdict;
  correlationKey: string;
  rho: number;
  comboType: ComboType;
  trace: ReasoningEntry[];
  generatedAt: string;
}
