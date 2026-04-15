import type { MatchId, TeamId } from "@/domain/ids";
import type { H2H, Intangibles, TeamForm } from "@/domain/history";

export interface HistoryProvider {
  readonly name: string;
  getForm(teamId: TeamId, lastN: number): Promise<TeamForm>;
  getH2H(homeId: TeamId, awayId: TeamId): Promise<H2H>;
  getIntangibles(matchId: MatchId): Promise<Intangibles>;
}
