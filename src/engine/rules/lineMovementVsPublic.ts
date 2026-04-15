import { selectionKey } from "@/domain/market";
import type { Rule, RuleOutput } from "../types";

const SHIFT_PCT_THRESHOLD = 0.03;
const PUBLIC_PCT_THRESHOLD = 60;

export const lineMovementVsPublic: Rule = {
  id: "line-movement-vs-public",
  description:
    "Reverse line movement: price shortens on the side the public is fading (sharp action).",
  markets: ["ML_1X2", "DNB", "AH", "OU_GOALS", "BTTS"],
  leg: "lines",
  defaultWeight: 1,
  run: ({ ctx, selection, price, config }): RuleOutput | null => {
    const opener = ctx.openers[selection.marketKey];
    const key = selectionKey(selection);
    const openerOffer = opener?.offers
      .filter((o) => selectionKey(o.selection) === key)
      .sort((a, b) => b.decimal - a.decimal)[0];
    if (!openerOffer) return null;

    const shiftPct = (price.decimal - openerOffer.decimal) / openerOffer.decimal;

    const splits = ctx.splits[selection.marketKey];
    const row = splits?.rows.find((r) => selectionKey(r.selection) === key);
    const publicPct = row?.betsPct;
    if (publicPct === undefined) return null;

    if (publicPct <= PUBLIC_PCT_THRESHOLD && shiftPct <= -SHIFT_PCT_THRESHOLD) {
      const strength = Math.min(0.3 + Math.abs(shiftPct) * 2, 0.7);
      return {
        ruleId: "line-movement-vs-public",
        leg: "lines",
        verdict: "SUPPORT",
        strength,
        weight: config.weight,
        message: `Price shortened ${(shiftPct * 100).toFixed(1)}% while public only ${publicPct}% · reverse line movement`,
        data: { shiftPct, publicPct, opener: openerOffer.decimal, current: price.decimal },
      };
    }

    if (publicPct >= 100 - PUBLIC_PCT_THRESHOLD && shiftPct >= SHIFT_PCT_THRESHOLD) {
      const strength = -Math.min(0.2 + Math.abs(shiftPct) * 2, 0.6);
      return {
        ruleId: "line-movement-vs-public",
        leg: "lines",
        verdict: "AGAINST",
        strength,
        weight: config.weight,
        message: `Price drifted ${(shiftPct * 100).toFixed(1)}% with ${publicPct}% public support · square money`,
        data: { shiftPct, publicPct, opener: openerOffer.decimal, current: price.decimal },
      };
    }

    return null;
  },
};
