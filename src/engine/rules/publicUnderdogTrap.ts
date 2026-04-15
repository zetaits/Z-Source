import { selectionKey } from "@/domain/market";
import { bestOfferForSelection, offersForMarket } from "../markets/shared";
import type { Rule, RuleOutput } from "../types";

const PUBLIC_THRESHOLD = 55;
const DOG_MIN_DECIMAL = 2.3;

export const publicUnderdogTrap: Rule = {
  id: "public-underdog-trap",
  description:
    "Public piling onto an underdog (>55% tickets @ ≥2.30) is a trap — sharps fade it.",
  markets: ["ML_1X2", "DNB", "BTTS", "OU_GOALS", "AH", "CORNERS_TOTAL"],
  leg: "sharpVsSquare",
  defaultWeight: 1,
  run: ({ ctx, selection, price, config }): RuleOutput | null => {
    if (price.decimal < DOG_MIN_DECIMAL) return null;
    const scopedOffers = offersForMarket(ctx, selection.marketKey).filter((o) =>
      selection.line === undefined ? true : o.selection.line === selection.line,
    );
    if (scopedOffers.length === 0) return null;
    const minOffer = scopedOffers.reduce(
      (min, cur) => (cur.decimal < min.decimal ? cur : min),
      scopedOffers[0],
    );
    const isUnderdog =
      bestOfferForSelection(
        ctx,
        selection.marketKey,
        (o) => selectionKey(o.selection) === selectionKey(selection),
      )?.decimal !== minOffer.decimal && price.decimal > minOffer.decimal;
    if (!isUnderdog) return null;

    const splits = ctx.splits[selection.marketKey];
    const row = splits?.rows.find((r) => selectionKey(r.selection) === selectionKey(selection));
    if (!row || row.betsPct === undefined) return null;
    if (row.betsPct < PUBLIC_THRESHOLD) return null;

    const strength = -Math.min(0.25 + (row.betsPct - PUBLIC_THRESHOLD) / 100, 0.5);
    return {
      ruleId: "public-underdog-trap",
      leg: "sharpVsSquare",
      verdict: "AGAINST",
      strength,
      weight: config.weight,
      message: `Underdog @ ${price.decimal.toFixed(2)} with ${row.betsPct}% public · trap pattern`,
      data: { publicPct: row.betsPct, decimal: price.decimal },
    };
  },
};
