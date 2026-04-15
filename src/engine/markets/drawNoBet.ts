import type { Selection } from "@/domain/market";
import type { Price } from "@/domain/odds";
import type { AnalysisContext } from "../context";
import type { MarketAdapter } from "../types";
import { bestPriceFor, offersForMarket, vigFreePairProb } from "./shared";

const SIDES = ["home", "away"] as const;
type Side = (typeof SIDES)[number];

export const drawNoBet: MarketAdapter = {
  key: "DNB",
  label: "Draw No Bet",

  enumerate(ctx: AnalysisContext): Selection[] {
    return offersForMarket(ctx, "DNB").length > 0
      ? SIDES.map((side) => ({ marketKey: "DNB", side }))
      : [];
  },

  bestPrice(selection: Selection, ctx: AnalysisContext): Price | undefined {
    return bestPriceFor(ctx, selection);
  },

  vigFreeProb(selection: Selection, ctx: AnalysisContext): number | undefined {
    return vigFreePairProb(
      ctx,
      "DNB",
      (o) => o.selection.side === "home",
      (o) => o.selection.side === "away",
      selection.side === "home",
    );
  },
};
