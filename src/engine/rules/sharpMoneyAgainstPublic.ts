import { selectionKey } from "@/domain/market";
import type { Rule, RuleOutput } from "../types";

const DELTA_THRESHOLD = 15;

export const sharpMoneyAgainstPublic: Rule = {
  id: "sharp-money-against-public",
  description:
    "Money % exceeds bets % by ≥15 points: bigger wagers going the opposite way of the crowd.",
  markets: ["ML_1X2", "DNB", "BTTS", "OU_GOALS", "AH", "CORNERS_TOTAL"],
  leg: "sharpVsSquare",
  defaultWeight: 1,
  run: ({ ctx, selection, config }): RuleOutput | null => {
    const splits = ctx.splits[selection.marketKey];
    if (!splits) return null;
    const row = splits.rows.find((r) => selectionKey(r.selection) === selectionKey(selection));
    if (!row || row.betsPct === undefined || row.moneyPct === undefined) return null;
    const delta = row.moneyPct - row.betsPct;
    if (delta < DELTA_THRESHOLD) return null;
    const strength = Math.min(0.25 + (delta - DELTA_THRESHOLD) / 50, 0.6);
    return {
      ruleId: "sharp-money-against-public",
      leg: "sharpVsSquare",
      verdict: "SUPPORT",
      strength,
      weight: config.weight,
      message: `Money ${row.moneyPct}% vs tickets ${row.betsPct}% (Δ +${delta.toFixed(0)}) · sharp-side`,
      data: { moneyPct: row.moneyPct, betsPct: row.betsPct, delta },
    };
  },
};
