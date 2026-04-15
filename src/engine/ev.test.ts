import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { clamp, edgePct, fairDecimal, impliedProb, removeVig } from "./ev";

describe("ev", () => {
  it("impliedProb is 1/decimal for valid odds", () => {
    expect(impliedProb(2)).toBeCloseTo(0.5);
    expect(impliedProb(4)).toBeCloseTo(0.25);
  });

  it("impliedProb returns 0 for decimal <= 1", () => {
    expect(impliedProb(1)).toBe(0);
    expect(impliedProb(0.5)).toBe(0);
  });

  it("removeVig normalizes to sum 1", () => {
    const raw = [0.55, 0.55];
    const fair = removeVig(raw);
    expect(fair.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(fair[0]).toBeCloseTo(0.5);
  });

  it("removeVig preserves ratios", () => {
    const raw = [0.6, 0.4];
    const fair = removeVig(raw);
    expect(fair[0] / fair[1]).toBeCloseTo(1.5);
  });

  it("edgePct is fairProb * decimal − 1", () => {
    expect(edgePct(0.5, 2.1)).toBeCloseTo(0.05);
    expect(edgePct(0.5, 1.9)).toBeCloseTo(-0.05);
  });

  it("fairDecimal is 1/prob", () => {
    expect(fairDecimal(0.5)).toBeCloseTo(2);
    expect(fairDecimal(0.25)).toBeCloseTo(4);
  });

  it("clamp keeps value in range", () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });

  it("property: removeVig always sums to ~1 for positive inputs", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.float({ min: Math.fround(0.01), max: Math.fround(0.99), noNaN: true }),
          { minLength: 2, maxLength: 5 },
        ),
        (probs) => {
          const fair = removeVig(probs);
          const sum = fair.reduce((a, b) => a + b, 0);
          expect(sum).toBeCloseTo(1, 5);
        },
      ),
    );
  });
});
