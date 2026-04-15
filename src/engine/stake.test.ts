import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { DEFAULT_STAKE_POLICY } from "@/domain/strategy";
import { kellyFraction, sizeStakeUnits } from "./stake";

describe("stake", () => {
  it("kellyFraction is 0 when fairProb <= implied prob", () => {
    expect(kellyFraction(0.5, 2)).toBe(0);
    expect(kellyFraction(0.4, 2)).toBe(0);
  });

  it("kellyFraction is positive when edge exists", () => {
    const f = kellyFraction(0.6, 2);
    expect(f).toBeGreaterThan(0);
    expect(f).toBeCloseTo(0.2, 5);
  });

  it("kellyFraction handles invalid inputs", () => {
    expect(kellyFraction(0, 2)).toBe(0);
    expect(kellyFraction(1, 2)).toBe(0);
    expect(kellyFraction(0.5, 1)).toBe(0);
  });

  it("FLAT policy returns flatUnits capped at max", () => {
    const units = sizeStakeUnits({
      policy: { ...DEFAULT_STAKE_POLICY, kind: "FLAT", flatUnits: 2, maxUnitsPerPlay: 3 },
      fairProb: 0.5,
      priceDecimal: 2,
      confidence: 1,
      unitBankrollFraction: 0.01,
    });
    expect(units).toBe(2);
  });

  it("FLAT policy honours maxUnitsPerPlay cap", () => {
    const units = sizeStakeUnits({
      policy: { ...DEFAULT_STAKE_POLICY, kind: "FLAT", flatUnits: 10, maxUnitsPerPlay: 3 },
      fairProb: 0.5,
      priceDecimal: 2,
      confidence: 1,
      unitBankrollFraction: 0.01,
    });
    expect(units).toBe(3);
  });

  it("FRACTIONAL_KELLY scales by kellyFraction and confidence", () => {
    const units = sizeStakeUnits({
      policy: { ...DEFAULT_STAKE_POLICY, kellyFraction: 0.5, maxUnitsPerPlay: 100 },
      fairProb: 0.6,
      priceDecimal: 2,
      confidence: 1,
      unitBankrollFraction: 0.01,
    });
    expect(units).toBeCloseTo(10, 5);
  });

  it("FRACTIONAL_KELLY never exceeds maxUnitsPerPlay", () => {
    const units = sizeStakeUnits({
      policy: { ...DEFAULT_STAKE_POLICY, kellyFraction: 1, maxUnitsPerPlay: 2 },
      fairProb: 0.9,
      priceDecimal: 3,
      confidence: 1,
      unitBankrollFraction: 0.001,
    });
    expect(units).toBeLessThanOrEqual(2);
  });

  it("FRACTIONAL_KELLY returns 0 when no edge", () => {
    const units = sizeStakeUnits({
      policy: DEFAULT_STAKE_POLICY,
      fairProb: 0.4,
      priceDecimal: 2,
      confidence: 1,
      unitBankrollFraction: 0.01,
    });
    expect(units).toBe(0);
  });

  it("property: kellyFraction is monotonic in fairProb", () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1.1), max: 10, noNaN: true }),
        fc.float({ min: Math.fround(0.1), max: Math.fround(0.5), noNaN: true }),
        fc.float({ min: Math.fround(0.01), max: Math.fround(0.2), noNaN: true }),
        (price, base, delta) => {
          const p1 = base;
          const p2 = Math.min(0.99, base + delta);
          expect(kellyFraction(p2, price)).toBeGreaterThanOrEqual(
            kellyFraction(p1, price) - 1e-9,
          );
        },
      ),
    );
  });
});
