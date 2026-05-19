import type { AdjustingLeg, Leg, LegCaps, LegWeights } from "@/domain/strategy";
import type { RuleOutput } from "./types";
import { clamp } from "./ev";

const ADJUSTING_LEGS: AdjustingLeg[] = [
  "matchup",
  "trends",
  "lines",
  "sharpVsSquare",
  "intangibles",
];

export interface BondedMeta {
  positiveLegsCount: number;
  negativeStrong: boolean;
}

export interface CombinedSignal {
  fairProb: number;
  confidence: number;
  perLegSignal: Record<Leg, number>;
  overallSignal: number;
  meta: BondedMeta;
}

/** Apply 1/√N decorrelation discount when multiple rules of the same family
 * fire in the same leg — prevents stacking when the rules share data sources
 * (e.g. xG Poisson rules all derive from team xG → BTTS/DC/TTG outputs are
 * highly correlated). Items without a family pass through with full weight. */
const applyFamilyDiscount = (items: RuleOutput[]): { weight: number; strength: number }[] => {
  const byFamily = new Map<string, number>();
  for (const item of items) {
    if (!item.family) continue;
    byFamily.set(item.family, (byFamily.get(item.family) ?? 0) + 1);
  }
  return items.map((item) => {
    const baseWeight = Math.max(0, item.weight);
    if (!item.family) return { weight: baseWeight, strength: item.strength };
    const count = byFamily.get(item.family) ?? 1;
    const discount = count > 1 ? 1 / Math.sqrt(count) : 1;
    return { weight: baseWeight * discount, strength: item.strength };
  });
};

const legSignal = (items: RuleOutput[]): number => {
  const adjusted = applyFamilyDiscount(items);
  const weightSum = adjusted.reduce((s, i) => s + i.weight, 0);
  if (weightSum <= 0) return 0;
  const weighted = adjusted.reduce((s, i) => s + i.strength * i.weight, 0);
  return clamp(weighted / weightSum, -1, 1);
};

export const combine = (
  outputs: RuleOutput[],
  baseProb: number,
  legWeights: LegWeights,
  legCaps: LegCaps,
): CombinedSignal => {
  const byLeg = new Map<Leg, RuleOutput[]>();
  for (const o of outputs) {
    const bucket = byLeg.get(o.leg) ?? [];
    bucket.push(o);
    byLeg.set(o.leg, bucket);
  }

  const perLegSignal = {
    matchup: 0,
    trends: 0,
    lines: 0,
    sharpVsSquare: 0,
    intangibles: 0,
    math: 0,
  } as Record<Leg, number>;

  for (const [leg, items] of byLeg) {
    perLegSignal[leg] = legSignal(items);
  }

  // fairProb: each adjusting leg contributes perLegSignal[leg] * cap[leg]
  const probShift = ADJUSTING_LEGS.reduce(
    (s, l) => s + perLegSignal[l] * legCaps[l],
    0,
  );
  const fairProb = clamp(baseProb + probShift, 0.001, 0.999);

  // overallSignal: weighted mean of adjusting leg signals (used for confidence)
  const totalWeight = ADJUSTING_LEGS.reduce((s, l) => s + legWeights[l], 0);
  const overallSignal =
    totalWeight > 0
      ? ADJUSTING_LEGS.reduce(
          (s, l) => s + perLegSignal[l] * legWeights[l],
          0,
        ) / totalWeight
      : 0;

  // confidence: sign-aware — 0 when overall signal is not positive
  const weightedMean = overallSignal;
  const varWeighted =
    totalWeight > 0
      ? ADJUSTING_LEGS.reduce(
          (s, l) =>
            s + legWeights[l] * Math.pow(perLegSignal[l] - weightedMean, 2),
          0,
        ) / totalWeight
      : 0;
  const stddev = Math.sqrt(varWeighted);

  const positiveLegsCount = ADJUSTING_LEGS.filter(
    (l) => perLegSignal[l] > 0,
  ).length;
  const negativeStrong = ADJUSTING_LEGS.some((l) => perLegSignal[l] < -0.4);

  const confidence =
    overallSignal > 0
      ? clamp(
          (1 - stddev) * (positiveLegsCount / ADJUSTING_LEGS.length),
          0,
          1,
        )
      : 0;

  return {
    fairProb,
    confidence,
    perLegSignal,
    overallSignal,
    meta: { positiveLegsCount, negativeStrong },
  };
};
