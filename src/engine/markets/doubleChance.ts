import type { Selection } from "@/domain/market";
import type { Price } from "@/domain/odds";
import { BookId } from "@/domain/ids";
import { impliedProb, removeVig } from "../ev";
import type { AnalysisContext } from "../context";
import type { MarketAdapter } from "../types";
import { bestOfferForSelection, bestPriceFor, offersForMarket } from "./shared";

const DC_SIDES = ["1X", "12", "X2"] as const;
type DcSide = (typeof DC_SIDES)[number];

const ML_SIDES = ["home", "draw", "away"] as const;

const SYNTHETIC_BOOK = BookId("synthetic-from-ml");

const dcVigFreeFromMl = (
  ctx: AnalysisContext,
): Record<DcSide, number> | undefined => {
  const offers = ML_SIDES.map((side) =>
    bestOfferForSelection(ctx, "ML_1X2", (o) => o.selection.side === side),
  );
  if (offers.some((o) => !o)) return undefined;
  const raw = offers.map((o) => impliedProb(o!.decimal));
  const [pHome, pDraw, pAway] = removeVig(raw);
  return {
    "1X": pHome + pDraw,
    "12": pHome + pAway,
    "X2": pDraw + pAway,
  };
};

const dcVigFreeFromDcOffers = (
  ctx: AnalysisContext,
): Record<DcSide, number> | undefined => {
  const offers = DC_SIDES.map((side) =>
    bestOfferForSelection(ctx, "DC", (o) => o.selection.side === side),
  );
  if (offers.some((o) => !o)) return undefined;
  const raw = offers.map((o) => impliedProb(o!.decimal));
  const sum = raw.reduce((s, p) => s + p, 0);
  if (sum <= 0) return undefined;
  const factor = 2 / sum;
  return {
    "1X": raw[0] * factor,
    "12": raw[1] * factor,
    "X2": raw[2] * factor,
  };
};

export const doubleChance: MarketAdapter = {
  key: "DC",
  label: "Double Chance",

  enumerate(ctx: AnalysisContext): Selection[] {
    const dcOffers = offersForMarket(ctx, "DC");
    const mlOffers = offersForMarket(ctx, "ML_1X2");
    if (dcOffers.length === 0 && mlOffers.length === 0) return [];
    return DC_SIDES.map((side) => ({ marketKey: "DC", side }));
  },

  bestPrice(selection: Selection, ctx: AnalysisContext): Price | undefined {
    const direct = bestPriceFor(ctx, selection);
    if (direct) return direct;
    const probs = dcVigFreeFromMl(ctx);
    if (!probs) return undefined;
    const p = probs[selection.side as DcSide];
    if (p === undefined || p <= 0) return undefined;
    return {
      decimal: 1 / p,
      book: SYNTHETIC_BOOK,
      takenAt: ctx.generatedAt,
    };
  },

  vigFreeProb(selection: Selection, ctx: AnalysisContext): number | undefined {
    const fromDc = dcVigFreeFromDcOffers(ctx);
    if (fromDc) return fromDc[selection.side as DcSide];
    const fromMl = dcVigFreeFromMl(ctx);
    return fromMl ? fromMl[selection.side as DcSide] : undefined;
  },
};
