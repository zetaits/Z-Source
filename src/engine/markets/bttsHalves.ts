import type { MarketKey, Selection } from "@/domain/market";
import type { Price } from "@/domain/odds";
import type { AnalysisContext } from "../context";
import type { MarketAdapter } from "../types";
import { bestPriceFor, offersForMarket, vigFreePairProb } from "./shared";

type BttsHalfKey = "BTTS_1H" | "BTTS_2H";

const makeAdapter = (key: BttsHalfKey, label: string): MarketAdapter => ({
  key,
  label,

  enumerate(ctx: AnalysisContext): Selection[] {
    return offersForMarket(ctx, key).length > 0
      ? [
          { marketKey: key, side: "yes" },
          { marketKey: key, side: "no" },
        ]
      : [];
  },

  bestPrice(selection: Selection, ctx: AnalysisContext): Price | undefined {
    return bestPriceFor(ctx, selection);
  },

  vigFreeProb(selection: Selection, ctx: AnalysisContext): number | undefined {
    return vigFreePairProb(
      ctx,
      key as MarketKey,
      (o) => o.selection.side === "yes",
      (o) => o.selection.side === "no",
      selection.side === "yes",
    );
  },
});

export const bttsFirstHalf = makeAdapter("BTTS_1H", "BTTS · 1st Half");
export const bttsSecondHalf = makeAdapter("BTTS_2H", "BTTS · 2nd Half");
