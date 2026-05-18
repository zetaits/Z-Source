import type { BookId, MatchId } from "@/domain/ids";
import type { MarketKey } from "@/domain/market";
import type { BookOffer, LineSnapshot } from "@/domain/odds";

export interface QuotaSnapshot {
  remaining: number | null;
  used: number | null;
  resetAt: string | null;
  lastSyncedAt: string | null;
}

export interface ProviderEvent {
  eventId: string;
  homeName: string;
  awayName: string;
  kickoffAt: string;
}

export interface OddsRequestContext {
  /** league-level sport key (e.g. `soccer_epl`, `soccer_italy_serie_a`). Required by the-odds-api; optional elsewhere. */
  sportKey?: string;
  signal?: AbortSignal;
}

export interface OddsMovements {
  opener: BookOffer[];
  latest: BookOffer[];
  movements: BookOffer[][];
}

export interface OddsProvider {
  readonly name: string;
  getOdds(
    matchId: MatchId,
    markets: MarketKey[],
    context?: OddsRequestContext,
  ): Promise<LineSnapshot[]>;
  snapshotOpeners(
    matchId: MatchId,
    context?: OddsRequestContext,
  ): Promise<LineSnapshot[]>;
  getMovements?(
    matchId: MatchId,
    marketKey: MarketKey,
    book: BookId,
    line?: number,
    context?: OddsRequestContext,
  ): Promise<OddsMovements | null>;
  listEvents(sportKey: string): Promise<ProviderEvent[]>;
  quota(): QuotaSnapshot;
}
