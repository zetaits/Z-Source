import type { BookId, MatchId } from "./ids";
import type { MarketKey, Selection } from "./market";

export interface Price {
  decimal: number;
  book: BookId;
  takenAt: string;
}

export interface BookOffer {
  book: BookId;
  selection: Selection;
  decimal: number;
  takenAt: string;
}

export interface LineSnapshot {
  matchId: MatchId;
  marketKey: MarketKey;
  offers: BookOffer[];
  takenAt: string;
  isOpener?: boolean;
}

export const americanToDecimal = (american: number): number =>
  american > 0 ? american / 100 + 1 : 100 / Math.abs(american) + 1;

export const decimalToImplied = (decimal: number): number => 1 / decimal;
