import type { MatchId } from "@/domain/ids";
import type { MarketKey } from "@/domain/market";
import type { Splits } from "@/domain/splits";

export interface SplitProviderCapabilities {
  markets: MarketKey[];
  hasHandle: boolean;
  hasMoneyPct: boolean;
}

export interface SplitMatchContext {
  homeName: string;
  awayName: string;
  kickoffAt: string;
}

export interface SplitProviderQuery {
  linesByMarket?: Partial<Record<MarketKey, number[]>>;
  matchContext?: SplitMatchContext;
}

export interface SplitProvider {
  readonly name: string;
  readonly capabilities: SplitProviderCapabilities;
  getSplits(
    matchId: MatchId,
    markets: MarketKey[],
    query?: SplitProviderQuery,
  ): Promise<Splits[] | null>;
}
