import type { Selection } from "@/domain/market";
import type { Price } from "@/domain/odds";
import type { AnalysisContext } from "../context";
import type { MarketAdapter } from "../types";
import {
  bestPriceFor,
  offersForMarket,
  uniqueLines,
  vigFreePairProb,
} from "./shared";

export const cornersTotal: MarketAdapter = {
  key: "CORNERS_TOTAL",
  label: "Total Corners",

  enumerate(ctx: AnalysisContext): Selection[] {
    const offers = offersForMarket(ctx, "CORNERS_TOTAL");
    const lines = uniqueLines(offers);
    const out: Selection[] = [];
    for (const line of lines) {
      out.push({ marketKey: "CORNERS_TOTAL", side: "over", line });
      out.push({ marketKey: "CORNERS_TOTAL", side: "under", line });
    }
    return out;
  },

  bestPrice(selection: Selection, ctx: AnalysisContext): Price | undefined {
    return bestPriceFor(ctx, selection);
  },

  vigFreeProb(selection: Selection, ctx: AnalysisContext): number | undefined {
    if (selection.line === undefined) return undefined;
    return vigFreePairProb(
      ctx,
      "CORNERS_TOTAL",
      (o) => o.selection.side === "over" && o.selection.line === selection.line,
      (o) => o.selection.side === "under" && o.selection.line === selection.line,
      selection.side === "over",
    );
  },
};
