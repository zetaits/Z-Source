import type { MarketKey } from "./market";

export type Leg = "matchup" | "trends" | "lines" | "sharpVsSquare" | "intangibles" | "math";
export type AdjustingLeg = Exclude<Leg, "math">;

export interface LegWeights {
  matchup: number;
  trends: number;
  lines: number;
  sharpVsSquare: number;
  intangibles: number;
}

export type LegCaps = Record<AdjustingLeg, number>;

export const DEFAULT_LEG_WEIGHTS: LegWeights = {
  matchup: 0.20,
  trends: 0.15,
  lines: 0.25,
  sharpVsSquare: 0.25,
  intangibles: 0.15,
};

export const DEFAULT_LEG_CAPS: LegCaps = {
  matchup: 0.04,
  trends: 0.03,
  lines: 0.05,
  sharpVsSquare: 0.05,
  intangibles: 0.03,
};

export type StakeKind = "FLAT" | "FRACTIONAL_KELLY";

export interface StakePolicy {
  kind: StakeKind;
  kellyFraction: number;
  maxUnitsPerPlay: number;
  flatUnits: number;
  minEdgePct: number;
  minConfidence: number;
}

export const DEFAULT_STAKE_POLICY: StakePolicy = {
  kind: "FRACTIONAL_KELLY",
  kellyFraction: 0.25,
  maxUnitsPerPlay: 3,
  flatUnits: 1,
  minEdgePct: 0.02,
  minConfidence: 0.4,
};

export interface RuleConfig {
  ruleId: string;
  enabled: boolean;
  weight: number;
  params?: Record<string, unknown>;
}

export interface StrategyConfig {
  legWeights: LegWeights;
  legCaps: LegCaps;
  minLegsAlignedForBonded: number;
  stakePolicy: StakePolicy;
  rules: RuleConfig[];
  enabledMarkets: MarketKey[];
}
