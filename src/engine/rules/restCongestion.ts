import type { Rule, RuleOutput } from "../types";

const REST_DIFF_MIN = 2;
const REST_DIFF_CAP = 6;
const BASE_STRENGTH = 0.15;
const STRENGTH_PER_EXCESS_DAY = 0.08;
const MAX_STRENGTH = 0.5;

const FATIGUE_THRESHOLD = 3;
const FATIGUE_BASE = 0.18;
const FATIGUE_PER_DAY = 0.08;
const FATIGUE_MAX = 0.35;

const alignmentForSide = (side: string, delta: number): boolean | null => {
  if (side === "home") return delta > 0;
  if (side === "away") return delta < 0;
  return null;
};

export const restCongestion: Rule = {
  id: "rest-congestion",
  description:
    "Rest differential tilts outright markets toward fresher side; minimum rest below threshold suppresses goal tempo on totals/BTTS.",
  markets: ["ML_1X2", "DNB", "AH", "OU_GOALS", "BTTS"],
  leg: "intangibles",
  defaultWeight: 1,
  run: ({ ctx, selection, config }): RuleOutput | null => {
    const intangibles = ctx.intangibles;
    if (!intangibles) return null;
    const { homeRestDays, awayRestDays } = intangibles;
    if (homeRestDays === undefined || awayRestDays === undefined) return null;

    const marketKey = selection.marketKey;

    if (marketKey === "OU_GOALS" || marketKey === "BTTS") {
      const minRest = Math.min(homeRestDays, awayRestDays);
      if (minRest >= FATIGUE_THRESHOLD) return null;

      const deficit = FATIGUE_THRESHOLD - minRest;
      const magnitude = Math.min(FATIGUE_BASE + deficit * FATIGUE_PER_DAY, FATIGUE_MAX);

      const wantsLowTempo =
        marketKey === "OU_GOALS" ? selection.side === "under" : selection.side === "no";
      const strength = wantsLowTempo ? magnitude : -magnitude;

      return {
        ruleId: "rest-congestion",
        leg: "intangibles",
        verdict: wantsLowTempo ? "SUPPORT" : "AGAINST",
        strength,
        weight: config.weight,
        message: `Fatigue · min rest ${minRest}d (home ${homeRestDays}d / away ${awayRestDays}d) suppresses tempo`,
        data: { homeRestDays, awayRestDays, minRest, deficit, mode: "fatigue" },
      };
    }

    const delta = homeRestDays - awayRestDays;
    if (Math.abs(delta) < REST_DIFF_MIN) return null;

    const aligned = alignmentForSide(selection.side, delta);
    if (aligned === null) return null;

    const capped = Math.min(Math.abs(delta), REST_DIFF_CAP);
    const magnitude = Math.min(
      BASE_STRENGTH + (capped - REST_DIFF_MIN) * STRENGTH_PER_EXCESS_DAY,
      MAX_STRENGTH,
    );
    const strength = aligned ? magnitude : -magnitude;
    const fresherSide = delta > 0 ? "home" : "away";

    return {
      ruleId: "rest-congestion",
      leg: "intangibles",
      verdict: aligned ? "SUPPORT" : "AGAINST",
      strength,
      weight: config.weight,
      message: `Rest Δ ${delta > 0 ? "+" : ""}${delta}d (home ${homeRestDays}d / away ${awayRestDays}d) · ${fresherSide} fresher`,
      data: { homeRestDays, awayRestDays, delta, fresherSide, mode: "differential" },
    };
  },
};
