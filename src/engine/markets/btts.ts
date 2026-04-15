import type { Selection } from "@/domain/market";
import type { Price } from "@/domain/odds";
import type { AnalysisContext } from "../context";
import type { MarketAdapter } from "../types";
import { bestPriceFor, offersForMarket, vigFreePairProb } from "./shared";

export const btts: MarketAdapter = {
  key: "BTTS",
  label: "Both Teams to Score",

  enumerate(ctx: AnalysisContext): Selection[] {
    return offersForMarket(ctx, "BTTS").length > 0
      ? [
          { marketKey: "BTTS", side: "yes" },
          { marketKey: "BTTS", side: "no" },
        ]
      : [];
  },

  bestPrice(selection: Selection, ctx: AnalysisContext): Price | undefined {
    return bestPriceFor(ctx, selection);
  },

  vigFreeProb(selection: Selection, ctx: AnalysisContext): number | undefined {
    return vigFreePairProb(
      ctx,
      "BTTS",
      (o) => o.selection.side === "yes",
      (o) => o.selection.side === "no",
      selection.side === "yes",
    );
  },
};
