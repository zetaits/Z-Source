import type { MarketKey, Selection } from "@/domain/market";
import type { Price } from "@/domain/odds";
import type { AnalysisContext } from "../context";
import type { MarketAdapter } from "../types";
import {
  bestPriceFor,
  offersForMarket,
  uniqueLines,
  vigFreePairProb,
} from "./shared";

type TtgKey = "TTG_HOME" | "TTG_AWAY";

const makeAdapter = (key: TtgKey, label: string): MarketAdapter => ({
  key,
  label,

  enumerate(ctx: AnalysisContext): Selection[] {
    const offers = offersForMarket(ctx, key);
    const lines = uniqueLines(offers);
    const out: Selection[] = [];
    for (const line of lines) {
      out.push({ marketKey: key, side: "over", line });
      out.push({ marketKey: key, side: "under", line });
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
      key as MarketKey,
      (o) => o.selection.side === "over" && o.selection.line === selection.line,
      (o) => o.selection.side === "under" && o.selection.line === selection.line,
      selection.side === "over",
    );
  },
});

export const teamTotalGoalsHome = makeAdapter("TTG_HOME", "Home Total Goals");
export const teamTotalGoalsAway = makeAdapter("TTG_AWAY", "Away Total Goals");
