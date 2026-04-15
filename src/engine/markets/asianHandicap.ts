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

export const asianHandicap: MarketAdapter = {
  key: "AH",
  label: "Asian Handicap",

  enumerate(ctx: AnalysisContext): Selection[] {
    const offers = offersForMarket(ctx, "AH");
    const lines = uniqueLines(offers);
    const out: Selection[] = [];
    for (const line of lines) {
      out.push({ marketKey: "AH", side: "home", line });
      out.push({ marketKey: "AH", side: "away", line: -line });
    }
    return out;
  },

  bestPrice(selection: Selection, ctx: AnalysisContext): Price | undefined {
    return bestPriceFor(ctx, selection);
  },

  vigFreeProb(selection: Selection, ctx: AnalysisContext): number | undefined {
    if (selection.line === undefined) return undefined;
    const pairedLine = -selection.line;
    const otherSide = selection.side === "home" ? "away" : "home";
    return vigFreePairProb(
      ctx,
      "AH",
      (o) => o.selection.side === selection.side && o.selection.line === selection.line,
      (o) => o.selection.side === otherSide && o.selection.line === pairedLine,
      true,
    );
  },
};
