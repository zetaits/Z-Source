import type { LegWeights, Leg } from "@/domain/strategy";
import type { RuleOutput } from "./types";
import { clamp } from "./ev";

export const MAX_PROB_SHIFT = 0.12;

const ADJUSTING_LEGS: Leg[] = [
  "matchup",
  "trends",
  "lines",
  "sharpVsSquare",
  "intangibles",
];

export interface CombinedSignal {
  fairProb: number;
  confidence: number;
  perLegSignal: Record<Leg, number>;
  overallSignal: number;
}

const legSignal = (items: RuleOutput[]): number => {
  const weightSum = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
  if (weightSum <= 0) return 0;
  const weighted = items.reduce(
    (s, i) => s + i.strength * Math.max(0, i.weight),
    0,
  );
  return clamp(weighted / weightSum, -1, 1);
};

export const combine = (
  outputs: RuleOutput[],
  baseProb: number,
  legWeights: LegWeights,
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

  const totalWeight = ADJUSTING_LEGS.reduce((s, l) => s + legWeights[l], 0);
  const overallSignal =
    totalWeight > 0
      ? ADJUSTING_LEGS.reduce(
          (s, l) => s + perLegSignal[l] * legWeights[l],
          0,
        ) / totalWeight
      : 0;

  const fairProb = clamp(baseProb + overallSignal * MAX_PROB_SHIFT, 0.001, 0.999);

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
  const confidence = clamp(1 - stddev, 0, 1);

  return { fairProb, confidence, perLegSignal, overallSignal };
};
