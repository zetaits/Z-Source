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
