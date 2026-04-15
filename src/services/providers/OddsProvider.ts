import type { MatchId } from "@/domain/ids";
import type { MarketKey } from "@/domain/market";
import type { LineSnapshot } from "@/domain/odds";

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

export interface OddsProvider {
  readonly name: string;
  getOdds(matchId: MatchId, markets: MarketKey[]): Promise<LineSnapshot[]>;
  snapshotOpeners(matchId: MatchId): Promise<LineSnapshot[]>;
  listEvents(sportKey: string): Promise<ProviderEvent[]>;
  quota(): QuotaSnapshot;
}
