import type { Rule, RuleOutput } from "../types";
import { clamp } from "../ev";

const REGRESSION_THRESHOLD = 2.5;
const BASE_STRENGTH = 0.2;
const STRENGTH_PER_EXCESS_PT = 0.06;
const MAX_STRENGTH = 0.55;

export const xPointsRegression: Rule = {
  id: "xpoints-regression",
  description:
    "Team over/under-performing xPoints by ≥2.5 pts signals an imminent regression in outright markets.",
  markets: ["ML_1X2", "DNB", "AH"],
  leg: "trends",
  defaultWeight: 1,
  run: ({ ctx, selection, config }): RuleOutput | null => {
    const form =
      selection.side === "home" ? ctx.homeForm : ctx.awayForm;
    if (!form) return null;
    if (
      form.xPointsLast === undefined ||
      form.pointsLast === undefined ||
      form.lastN === 0
    )
      return null;

    const delta = form.pointsLast - form.xPointsLast;
    if (Math.abs(delta) < REGRESSION_THRESHOLD) return null;

    // Positive delta = over-performing → negative signal (regression expected)
    if (selection.side === "draw") return null;
    // Fade over-performers, back under-performers
    const teamOverperforms = delta > 0;
    const sideMultiplier = teamOverperforms ? -1 : 1;

    const excess = Math.abs(delta) - REGRESSION_THRESHOLD;
    const magnitude = clamp(BASE_STRENGTH + excess * STRENGTH_PER_EXCESS_PT, 0, MAX_STRENGTH);
    const strength = sideMultiplier * magnitude;
    const direction = delta > 0 ? "over-performing" : "under-performing";
    const teamLabel = selection.side === "home" ? "Home" : "Away";

    return {
      ruleId: "xpoints-regression",
      leg: "trends",
      verdict: strength > 0 ? "SUPPORT" : "AGAINST",
      strength,
      weight: config.weight,
      message: `${teamLabel} ${direction} vs xPoints (real ${form.pointsLast.toFixed(1)} / xPts ${form.xPointsLast.toFixed(1)}, Δ ${delta > 0 ? "+" : ""}${delta.toFixed(1)}) · regression signal`,
      data: {
        pointsLast: form.pointsLast,
        xPointsLast: form.xPointsLast,
        delta,
        lastN: form.lastN,
      },
    };
  },
};
