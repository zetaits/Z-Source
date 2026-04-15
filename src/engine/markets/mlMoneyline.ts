import type { Selection } from "@/domain/market";
import type { Price } from "@/domain/odds";
import { impliedProb, removeVig } from "../ev";
import type { AnalysisContext } from "../context";
import type { MarketAdapter } from "../types";
import { bestOfferForSelection, bestPriceFor, offersForMarket } from "./shared";

const SIDES = ["home", "draw", "away"] as const;
type Side = (typeof SIDES)[number];

const selectionFor = (side: Side): Selection => ({ marketKey: "ML_1X2", side });

export const mlMoneyline: MarketAdapter = {
  key: "ML_1X2",
  label: "Match Result (1X2)",

  enumerate(ctx: AnalysisContext): Selection[] {
    return offersForMarket(ctx, "ML_1X2").length > 0
      ? SIDES.map(selectionFor)
      : [];
  },

  bestPrice(selection: Selection, ctx: AnalysisContext): Price | undefined {
    return bestPriceFor(ctx, selection);
  },

  vigFreeProb(selection: Selection, ctx: AnalysisContext): number | undefined {
    const offers = SIDES.map((side) =>
      bestOfferForSelection(ctx, "ML_1X2", (o) => o.selection.side === side),
    );
    if (offers.some((o) => !o)) return undefined;
    const raw = offers.map((o) => impliedProb(o!.decimal));
    const fair = removeVig(raw);
    const idx = SIDES.indexOf(selection.side as Side);
    return idx >= 0 ? fair[idx] : undefined;
  },
};
