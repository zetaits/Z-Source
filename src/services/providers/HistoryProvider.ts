import type { MatchId, TeamId } from "@/domain/ids";
import type { H2H, Intangibles, TeamForm } from "@/domain/history";

export interface HistoryTeamQuery {
  sofaScoreTeamId?: number;
  teamName?: string;
  signal?: AbortSignal;
  // Skip the read side of history_cache (form aggregate) and refetch from
  // source. Immutable per-event data (xG) keeps its own long-lived cache.
  forceRefresh?: boolean;
}

export interface HistoryMatchQuery {
  homeSofaScoreId?: number;
  awaySofaScoreId?: number;
  homeTeamName?: string;
  awayTeamName?: string;
  sofaEventId?: number;
  kickoffAt?: string;
  fdorgMatchId?: number;
  homeFdorgTeamId?: number;
  awayFdorgTeamId?: number;
  signal?: AbortSignal;
  // See HistoryTeamQuery.forceRefresh.
  forceRefresh?: boolean;
}

export interface HistoryProvider {
  readonly name: string;
  getForm(teamId: TeamId, lastN: number, query?: HistoryTeamQuery): Promise<TeamForm>;
  getH2H(homeId: TeamId, awayId: TeamId, query?: HistoryMatchQuery): Promise<H2H>;
  getIntangibles(matchId: MatchId, query?: HistoryMatchQuery): Promise<Intangibles>;
}
