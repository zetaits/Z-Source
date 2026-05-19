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
  /** Multiplier applied to stake when a pick is not "bonded" (≥ minLegsAlignedForBonded
   * positive legs, no strong negative). Defaults to 0.5 — half-stake for unbonded
   * picks to acknowledge weaker signal alignment. */
  unbondedFactor: number;
}

export const DEFAULT_STAKE_POLICY: StakePolicy = {
  kind: "FRACTIONAL_KELLY",
  kellyFraction: 0.25,
  maxUnitsPerPlay: 3,
  flatUnits: 1,
  minEdgePct: 0.015,
  minConfidence: 0.4,
  unbondedFactor: 0.5,
};

export interface RuleConfig {
  ruleId: string;
  enabled: boolean;
  weight: number;
  params?: Record<string, unknown>;
}

export interface ComboPolicy {
  enabled: boolean;
  minCombinedDecimal: number;
  minCombinedEdge: number;
  minCombinedFairProb: number;
  anchorMode: AnchorComboPolicy;
}

export interface AnchorComboPolicy {
  enabled: boolean;
  minBaseConfidence: number;
  maxBaseDecimal: number;
  minAnchorConfidence: number;
  minRho: number;
  targetMinDecimal: number;
  targetMaxDecimal: number;
}

export const DEFAULT_ANCHOR_POLICY: AnchorComboPolicy = {
  enabled: true,
  minBaseConfidence: 0.55,
  maxBaseDecimal: 1.7,
  minAnchorConfidence: 0.5,
  minRho: 0.2,
  targetMinDecimal: 1.6,
  targetMaxDecimal: 2.2,
};

export const DEFAULT_COMBO_POLICY: ComboPolicy = {
  enabled: true,
  minCombinedDecimal: 1.5,
  minCombinedEdge: 0.025,
  minCombinedFairProb: 0.35,
  anchorMode: DEFAULT_ANCHOR_POLICY,
};

export interface StrategyConfig {
  legWeights: LegWeights;
  legCaps: LegCaps;
  minLegsAlignedForBonded: number;
  stakePolicy: StakePolicy;
  rules: RuleConfig[];
  enabledMarkets: MarketKey[];
  comboPolicy: ComboPolicy;
}
