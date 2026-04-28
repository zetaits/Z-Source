import { selectionKey } from "@/domain/market";
import type { Rule, RuleOutput } from "../types";

// Fires only when splits are unavailable — sharpSquareDetector handles everything when splits exist.
export const lineMovementVsPublic: Rule = {
  id: "line-movement-vs-public",
  description:
    "Significant line movement (≥5%) from opener with no splits context. When splits are present, sharpSquareDetector takes over.",
  markets: ["ML_1X2", "DNB", "AH", "OU_GOALS", "BTTS"],
  leg: "lines",
  defaultWeight: 1,
  run: ({ ctx, selection, price, config }): RuleOutput | null => {
    if (ctx.splits[selection.marketKey]) return null;

    const opener = ctx.openers[selection.marketKey];
    const key = selectionKey(selection);
    const openerOffer = opener?.offers
      .filter((o) => selectionKey(o.selection) === key)
      .sort((a, b) => b.decimal - a.decimal)[0];
    if (!openerOffer) return null;

    const shiftPct = (price.decimal - openerOffer.decimal) / openerOffer.decimal;
    if (Math.abs(shiftPct) < 0.05) return null;

    const shortened = shiftPct < 0;
    const strength = shortened
      ? Math.min(0.2 + Math.abs(shiftPct) * 2, 0.5)
      : -Math.min(0.2 + shiftPct * 2, 0.5);

    return {
      ruleId: "line-movement-vs-public",
      leg: "lines",
      verdict: shortened ? "SUPPORT" : "AGAINST",
      strength,
      weight: config.weight,
      message: `Line ${shortened ? "shortened" : "drifted"} ${(Math.abs(shiftPct) * 100).toFixed(1)}% from opener (no splits context)`,
      data: { shiftPct, opener: openerOffer.decimal, current: price.decimal },
    };
  },
};
