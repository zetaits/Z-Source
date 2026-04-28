import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { DEFAULT_LEG_CAPS, DEFAULT_LEG_WEIGHTS } from "@/domain/strategy";
import { combine } from "./combine";
import type { RuleOutput } from "./types";

const mk = (overrides: Partial<RuleOutput>): RuleOutput => ({
  ruleId: "r",
  leg: "lines",
  verdict: "SUPPORT",
  strength: 0.5,
  weight: 1,
  message: "",
  ...overrides,
});

describe("combine", () => {
  it("returns baseProb unchanged when no outputs", () => {
    const { fairProb, overallSignal } = combine([], 0.5, DEFAULT_LEG_WEIGHTS, DEFAULT_LEG_CAPS);
    expect(fairProb).toBeCloseTo(0.5);
    expect(overallSignal).toBe(0);
  });

  it("math leg does not shift fairProb", () => {
    const outputs = [mk({ leg: "math", strength: 1 })];
    const { fairProb } = combine(outputs, 0.5, DEFAULT_LEG_WEIGHTS, DEFAULT_LEG_CAPS);
    expect(fairProb).toBeCloseTo(0.5);
  });

  it("all legs agreeing SUPPORT increases fairProb", () => {
    const outputs: RuleOutput[] = [
      mk({ leg: "matchup", strength: 0.5 }),
      mk({ leg: "trends", strength: 0.5 }),
      mk({ leg: "lines", strength: 0.5 }),
      mk({ leg: "sharpVsSquare", strength: 0.5 }),
      mk({ leg: "intangibles", strength: 0.5 }),
    ];
    const { fairProb, confidence } = combine(outputs, 0.4, DEFAULT_LEG_WEIGHTS, DEFAULT_LEG_CAPS);
    expect(fairProb).toBeGreaterThan(0.4);
    expect(confidence).toBeGreaterThan(0.9);
  });

  it("all legs AGAINST decreases fairProb", () => {
    const outputs: RuleOutput[] = [
      mk({ leg: "matchup", strength: -0.5 }),
      mk({ leg: "trends", strength: -0.5 }),
      mk({ leg: "lines", strength: -0.5 }),
      mk({ leg: "sharpVsSquare", strength: -0.5 }),
      mk({ leg: "intangibles", strength: -0.5 }),
    ];
    const { fairProb } = combine(outputs, 0.5, DEFAULT_LEG_WEIGHTS, DEFAULT_LEG_CAPS);
    expect(fairProb).toBeLessThan(0.5);
  });

  it("disagreement between legs lowers confidence vs full agreement", () => {
    const agree: RuleOutput[] = [
      mk({ leg: "matchup", strength: 0.5 }),
      mk({ leg: "lines", strength: 0.5 }),
    ];
    const conflict: RuleOutput[] = [
      mk({ leg: "matchup", strength: 0.8 }),
      mk({ leg: "lines", strength: -0.8 }),
    ];
    const a = combine(agree, 0.5, DEFAULT_LEG_WEIGHTS, DEFAULT_LEG_CAPS);
    const b = combine(conflict, 0.5, DEFAULT_LEG_WEIGHTS, DEFAULT_LEG_CAPS);
    expect(a.confidence).toBeGreaterThan(b.confidence);
  });

  it("respects per-rule weight within a leg", () => {
    const outputs: RuleOutput[] = [
      mk({ leg: "lines", strength: 1, weight: 3 }),
      mk({ leg: "lines", strength: -1, weight: 1 }),
    ];
    const { perLegSignal } = combine(outputs, 0.5, DEFAULT_LEG_WEIGHTS, DEFAULT_LEG_CAPS);
    expect(perLegSignal.lines).toBeCloseTo((3 - 1) / 4, 5);
  });

  it("fairProb is clamped into (0,1)", () => {
    const strong = Array.from({ length: 5 }).map((_, i) =>
      mk({ leg: (["matchup", "trends", "lines", "sharpVsSquare", "intangibles"] as const)[i], strength: 1 }),
    );
    const { fairProb } = combine(strong, 0.999, DEFAULT_LEG_WEIGHTS, DEFAULT_LEG_CAPS);
    expect(fairProb).toBeLessThan(1);
  });

  it("sign-aware confidence: all legs negative → confidence is 0", () => {
    const outputs: RuleOutput[] = [
      mk({ leg: "matchup", strength: -0.8 }),
      mk({ leg: "trends", strength: -0.8 }),
      mk({ leg: "lines", strength: -0.8 }),
      mk({ leg: "sharpVsSquare", strength: -0.8 }),
      mk({ leg: "intangibles", strength: -0.8 }),
    ];
    const { confidence } = combine(outputs, 0.5, DEFAULT_LEG_WEIGHTS, DEFAULT_LEG_CAPS);
    expect(confidence).toBe(0);
  });

  it("per-leg cap limits fairProb shift per leg", () => {
    const tightCaps = { matchup: 0.01, trends: 0.01, lines: 0.01, sharpVsSquare: 0.01, intangibles: 0.01 };
    const outputs: RuleOutput[] = [
      mk({ leg: "lines", strength: 1 }),
    ];
    const { fairProb } = combine(outputs, 0.5, DEFAULT_LEG_WEIGHTS, tightCaps);
    // lines cap = 0.01, signal = 1 → shift = 0.01
    expect(fairProb).toBeCloseTo(0.51, 3);
  });

  it("bonded meta: positiveLegsCount counts legs with perLegSignal > 0", () => {
    const outputs: RuleOutput[] = [
      mk({ leg: "matchup", strength: 0.5 }),
      mk({ leg: "trends", strength: 0.5 }),
      mk({ leg: "lines", strength: -0.3 }),
    ];
    const { meta } = combine(outputs, 0.5, DEFAULT_LEG_WEIGHTS, DEFAULT_LEG_CAPS);
    expect(meta.positiveLegsCount).toBe(2);
    expect(meta.negativeStrong).toBe(false);
  });

  it("bonded meta: negativeStrong triggers when any leg < -0.4", () => {
    const outputs: RuleOutput[] = [
      mk({ leg: "matchup", strength: 0.8 }),
      mk({ leg: "lines", strength: -0.9 }),
    ];
    const { meta } = combine(outputs, 0.5, DEFAULT_LEG_WEIGHTS, DEFAULT_LEG_CAPS);
    expect(meta.negativeStrong).toBe(true);
  });

  it("property: overallSignal stays within [-1,1]", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            leg: fc.constantFrom("matchup", "trends", "lines", "sharpVsSquare", "intangibles", "math" as const),
            strength: fc.float({ min: -1, max: 1, noNaN: true }),
            weight: fc.float({ min: Math.fround(0.1), max: 5, noNaN: true }),
          }),
          { minLength: 0, maxLength: 10 },
        ),
        fc.float({ min: Math.fround(0.05), max: Math.fround(0.95), noNaN: true }),
        (items, base) => {
          const outputs = items.map((i) =>
            mk({ leg: i.leg as RuleOutput["leg"], strength: i.strength, weight: i.weight }),
          );
          const { overallSignal } = combine(outputs, base, DEFAULT_LEG_WEIGHTS, DEFAULT_LEG_CAPS);
          expect(overallSignal).toBeGreaterThanOrEqual(-1);
          expect(overallSignal).toBeLessThanOrEqual(1);
        },
      ),
    );
  });
});
