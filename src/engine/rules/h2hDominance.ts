import type { Rule, RuleOutput } from "../types";

const MIN_MEETINGS = 4;
const DIFF_MIN = 0.4;
const BASE_STRENGTH = 0.2;
const STRENGTH_PER_EXCESS = 0.5;
const MAX_STRENGTH = 0.5;

const alignmentForSide = (side: string, delta: number): boolean | null => {
  if (side === "home") return delta > 0;
  if (side === "away") return delta < 0;
  return null;
};

export const h2hDominance: Rule = {
  id: "h2h-dominance",
  description:
    "One-sided head-to-head record (≥40pt win-rate gap over ≥4 meetings) tilts outright markets toward the dominant side.",
  markets: ["ML_1X2", "DNB", "AH"],
  leg: "matchup",
  defaultWeight: 0.8,
  run: ({ ctx, selection, config }): RuleOutput | null => {
    const h2h = ctx.h2h;
    if (!h2h) return null;
    const total = h2h.meetings.length;
    if (total < MIN_MEETINGS) return null;

    const homeRate = h2h.homeWins / total;
    const awayRate = h2h.awayWins / total;
    const delta = homeRate - awayRate;
    if (Math.abs(delta) < DIFF_MIN) return null;

    const aligned = alignmentForSide(selection.side, delta);
    if (aligned === null) return null;

    const excess = Math.abs(delta) - DIFF_MIN;
    const strength = Math.min(
      BASE_STRENGTH + excess * STRENGTH_PER_EXCESS,
      MAX_STRENGTH,
    );
    const dominantSide = delta > 0 ? "home" : "away";

    return {
      ruleId: "h2h-dominance",
      leg: "matchup",
      verdict: aligned ? "SUPPORT" : "AGAINST",
      strength,
      weight: config.weight,
      message: `H2H ${h2h.homeWins}W-${h2h.draws}D-${h2h.awayWins}L over ${total} meetings · ${dominantSide} dominant`,
      data: {
        homeWins: h2h.homeWins,
        awayWins: h2h.awayWins,
        draws: h2h.draws,
        meetings: total,
        delta,
        dominantSide,
      },
    };
  },
};
