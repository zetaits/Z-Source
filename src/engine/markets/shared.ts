import type { MarketKey, Selection } from "@/domain/market";
import { selectionKey } from "@/domain/market";
import type { BookOffer, LineSnapshot, Price } from "@/domain/odds";
import { impliedProb, removeVig } from "../ev";
import type { AnalysisContext } from "../context";

export const offersForMarket = (
  ctx: AnalysisContext,
  market: MarketKey,
): BookOffer[] => {
  const all = ctx.lines[market]?.offers ?? [];
  if (ctx.userBooks.length === 0) return all;
  const filtered = all.filter((o) => ctx.userBooks.includes(o.book));
  return filtered.length > 0 ? filtered : all;
};

export const bestOfferForSelection = (
  ctx: AnalysisContext,
  market: MarketKey,
  match: (offer: BookOffer) => boolean,
): BookOffer | undefined => {
  const offers = offersForMarket(ctx, market).filter(match);
  if (offers.length === 0) return undefined;
  return offers.reduce((best, cur) => (cur.decimal > best.decimal ? cur : best));
};

export const offerToPrice = (offer: BookOffer): Price => ({
  decimal: offer.decimal,
  book: offer.book,
  takenAt: offer.takenAt,
});

export const selectionsEqual = (a: Selection, b: Selection): boolean =>
  selectionKey(a) === selectionKey(b);

export const bestPriceFor = (
  ctx: AnalysisContext,
  selection: Selection,
): Price | undefined => {
  const best = bestOfferForSelection(ctx, selection.marketKey, (o) =>
    selectionsEqual(o.selection, selection),
  );
  return best ? offerToPrice(best) : undefined;
};

export const vigFreePairProb = (
  ctx: AnalysisContext,
  market: MarketKey,
  matchA: (o: import("@/domain/odds").BookOffer) => boolean,
  matchB: (o: import("@/domain/odds").BookOffer) => boolean,
  wantA: boolean,
): number | undefined => {
  const a = bestOfferForSelection(ctx, market, matchA);
  const b = bestOfferForSelection(ctx, market, matchB);
  if (!a || !b) return undefined;
  const [pa, pb] = removeVig([impliedProb(a.decimal), impliedProb(b.decimal)]);
  return wantA ? pa : pb;
};

export const uniqueLines = (offers: BookOffer[]): number[] => {
  const lines = new Set<number>();
  for (const o of offers) {
    if (o.selection.line !== undefined) lines.add(o.selection.line);
  }
  return Array.from(lines).sort((a, b) => a - b);
};
