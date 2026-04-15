import { selectionKey } from "@/domain/market";
import type { Rule, RuleOutput } from "../types";

const FAV_THRESHOLD_FT = 1.8;
const MIN_1H_PRICE = 2.1;

export const favFullMatchToFirstHalf: Rule = {
  id: "fav-full-match-to-first-half",
  description:
    "Heavy full-match favorites (≤ 1.80) often offer value on the 1H moneyline (price ≥ 2.10).",
  markets: ["ML_HT"],
  leg: "lines",
  defaultWeight: 1,
  run: ({ ctx, selection, price, config }): RuleOutput | null => {
    if (!["home", "away"].includes(selection.side)) return null;
    if (price.decimal < MIN_1H_PRICE) return null;

    const fullMatch = ctx.lines["ML_1X2"];
    if (!fullMatch) return null;
    const favOffer = fullMatch.offers
      .filter((o) => selectionKey(o.selection) === `ML_1X2:${selection.side}`)
      .sort((a, b) => a.decimal - b.decimal)[0];
    if (!favOffer || favOffer.decimal > FAV_THRESHOLD_FT) return null;

    const strength = Math.min(0.25 + (FAV_THRESHOLD_FT - favOffer.decimal) * 0.5, 0.55);
    return {
      ruleId: "fav-full-match-to-first-half",
      leg: "lines",
      verdict: "SUPPORT",
      strength,
      weight: config.weight,
      message: `Full-match favorite ${favOffer.decimal.toFixed(2)} · 1H price ${price.decimal.toFixed(2)} has value`,
      data: {
        fullMatchPrice: favOffer.decimal,
        firstHalfPrice: price.decimal,
        side: selection.side,
      },
    };
  },
};
