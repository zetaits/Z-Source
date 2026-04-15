import type { Rule, RuleOutput } from "../types";

const REST_DIFF_MIN = 2;
const REST_DIFF_CAP = 6;
const BASE_STRENGTH = 0.15;
const STRENGTH_PER_EXCESS_DAY = 0.08;
const MAX_STRENGTH = 0.5;

const alignmentForSide = (side: string, delta: number): boolean | null => {
  if (side === "home") return delta > 0;
  if (side === "away") return delta < 0;
  return null;
};

export const restCongestion: Rule = {
  id: "rest-congestion",
  description:
    "A meaningful rest differential (≥2 days) between clubs tilts outright markets toward the fresher side.",
  markets: ["ML_1X2", "DNB", "AH"],
  leg: "intangibles",
  defaultWeight: 1,
  run: ({ ctx, selection, config }): RuleOutput | null => {
    const intangibles = ctx.intangibles;
    if (!intangibles) return null;
    const { homeRestDays, awayRestDays } = intangibles;
    if (homeRestDays === undefined || awayRestDays === undefined) return null;

    const delta = homeRestDays - awayRestDays;
    if (Math.abs(delta) < REST_DIFF_MIN) return null;

    const aligned = alignmentForSide(selection.side, delta);
    if (aligned === null) return null;

    const magnitude = Math.min(Math.abs(delta), REST_DIFF_CAP);
    const strength = Math.min(
      BASE_STRENGTH + (magnitude - REST_DIFF_MIN) * STRENGTH_PER_EXCESS_DAY,
      MAX_STRENGTH,
    );
    const fresherSide = delta > 0 ? "home" : "away";

    return {
      ruleId: "rest-congestion",
      leg: "intangibles",
      verdict: aligned ? "SUPPORT" : "AGAINST",
      strength,
      weight: config.weight,
      message: `Rest Δ ${delta > 0 ? "+" : ""}${delta}d (home ${homeRestDays}d / away ${awayRestDays}d) · ${fresherSide} fresher`,
      data: { homeRestDays, awayRestDays, delta, fresherSide },
    };
  },
};
