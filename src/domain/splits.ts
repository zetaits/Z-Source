import type { MatchId } from "./ids";
import type { MarketKey, Selection } from "./market";

export interface SplitData {
  selection: Selection;
  betsPct?: number;
  moneyPct?: number;
  handlePct?: number;
}

export interface Splits {
  matchId: MatchId;
  marketKey: MarketKey;
  rows: SplitData[];
  source: string;
  bookId?: string;
  takenAt: string;
}

export const inferSharpSide = (s: SplitData): "BACK" | "FADE" | "NEUTRAL" => {
  if (s.betsPct === undefined || s.moneyPct === undefined) return "NEUTRAL";
  const delta = s.moneyPct - s.betsPct;
  if (delta >= 15) return "BACK";
  if (delta <= -15) return "FADE";
  return "NEUTRAL";
};
