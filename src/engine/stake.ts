import type { StakePolicy } from "@/domain/strategy";
import { clamp } from "./ev";

export const kellyFraction = (fairProb: number, priceDecimal: number): number => {
  const b = priceDecimal - 1;
  if (b <= 0 || fairProb <= 0 || fairProb >= 1) return 0;
  const q = 1 - fairProb;
  return Math.max(0, (fairProb * b - q) / b);
};

export interface SizeStakeInput {
  policy: StakePolicy;
  fairProb: number;
  priceDecimal: number;
  confidence: number;
  unitBankrollFraction: number;
}

export const sizeStakeUnits = ({
  policy,
  fairProb,
  priceDecimal,
  confidence,
  unitBankrollFraction,
}: SizeStakeInput): number => {
  if (policy.kind === "FLAT") {
    return Math.min(policy.flatUnits, policy.maxUnitsPerPlay);
  }
  const rawKelly = kellyFraction(fairProb, priceDecimal);
  const damped = rawKelly * clamp(policy.kellyFraction, 0, 1);
  const confidenceScale = clamp(confidence, 0.3, 1);
  const bankrollFraction = damped * confidenceScale;
  if (unitBankrollFraction <= 0) return 0;
  const units = bankrollFraction / unitBankrollFraction;
  return clamp(units, 0, policy.maxUnitsPerPlay);
};
