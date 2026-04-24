import type { MatchId, TeamId } from "@/domain/ids";
import type { H2H, Intangibles, TeamForm } from "@/domain/history";

export interface HistoryTeamQuery {
  sofaScoreTeamId?: number;
  teamName?: string;
}

export interface HistoryMatchQuery {
  homeSofaScoreId?: number;
  awaySofaScoreId?: number;
  sofaEventId?: number;
  kickoffAt?: string;
}

export interface HistoryProvider {
  readonly name: string;
  getForm(teamId: TeamId, lastN: number, query?: HistoryTeamQuery): Promise<TeamForm>;
  getH2H(homeId: TeamId, awayId: TeamId, query?: HistoryMatchQuery): Promise<H2H>;
  getIntangibles(matchId: MatchId, query?: HistoryMatchQuery): Promise<Intangibles>;
}
