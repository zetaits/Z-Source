import type { BetId, BookId, LeagueId, MatchId, PlayId } from "./ids";
import type { MarketKey, Selection } from "./market";
import type { PlayCandidate } from "./play";

export type BetStatus = "OPEN" | "WON" | "LOST" | "PUSH" | "VOID" | "CASHOUT";

export interface Bet {
  id: BetId;
  placedAt: string;
  matchId: MatchId;
  leagueId: LeagueId;
  marketKey: MarketKey;
  selection: Selection;
  priceDecimal: number;
  book: BookId;
  stakeUnits: number;
  stakeMinor: number;
  status: BetStatus;
  settledAt?: string;
  payoutMinor?: number;
  closingPriceDecimal?: number;
  notes?: string;
  playId?: PlayId;
  playSnapshot?: PlayCandidate;
}

export const profitMinor = (b: Bet): number => {
  if (b.payoutMinor === undefined) return 0;
  return b.payoutMinor - b.stakeMinor;
};

export const clvPct = (b: Bet): number | null => {
  if (b.closingPriceDecimal === undefined || b.closingPriceDecimal <= 0) return null;
  return (b.priceDecimal - b.closingPriceDecimal) / b.closingPriceDecimal;
};
