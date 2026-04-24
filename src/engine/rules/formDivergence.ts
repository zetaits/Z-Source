import type { Rule, RuleOutput } from "../types";

const PPG_DIFF_MIN = 0.5;
const BASE_STRENGTH = 0.2;
const STRENGTH_PER_EXCESS_PPG = 0.25;
const MAX_STRENGTH = 0.55;

const alignmentForSide = (side: string, delta: number): boolean | null => {
  if (side === "home") return delta > 0;
  if (side === "away") return delta < 0;
  return null;
};

export const formDivergence: Rule = {
  id: "form-divergence",
  description:
    "Recent points-per-game gap ≥0.5 PPG signals a matchup edge for the in-form side in outright markets.",
  markets: ["ML_1X2", "DNB", "AH"],
  leg: "matchup",
  defaultWeight: 1,
  run: ({ ctx, selection, config }): RuleOutput | null => {
    const { homeForm, awayForm } = ctx;
    if (!homeForm || !awayForm) return null;
    if (homeForm.lastN === 0 || awayForm.lastN === 0) return null;

    const delta = homeForm.ppgLast - awayForm.ppgLast;
    if (Math.abs(delta) < PPG_DIFF_MIN) return null;

    const aligned = alignmentForSide(selection.side, delta);
    if (aligned === null) return null;

    const excess = Math.abs(delta) - PPG_DIFF_MIN;
    const magnitude = Math.min(
      BASE_STRENGTH + excess * STRENGTH_PER_EXCESS_PPG,
      MAX_STRENGTH,
    );
    const strength = aligned ? magnitude : -magnitude;
    const inFormSide = delta > 0 ? "home" : "away";

    return {
      ruleId: "form-divergence",
      leg: "matchup",
      verdict: aligned ? "SUPPORT" : "AGAINST",
      strength,
      weight: config.weight,
      message: `Form PPG home ${homeForm.ppgLast.toFixed(2)} vs away ${awayForm.ppgLast.toFixed(2)} (Δ ${delta > 0 ? "+" : ""}${delta.toFixed(2)}) · ${inFormSide} in-form`,
      data: {
        homePpg: homeForm.ppgLast,
        awayPpg: awayForm.ppgLast,
        delta,
        inFormSide,
      },
    };
  },
};
