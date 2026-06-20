import type { MatchId, TeamId } from "@/domain/ids";
import type { H2H, Intangibles, TeamForm } from "@/domain/history";
import type { HistoryProvider } from "@/services/providers/HistoryProvider";

// No-op history provider. SofaScore (the previous source) was removed because
// it became too hard to scrape past DataDome. The HistoryProvider interface is
// kept so a new source can be plugged in later; until then football runs without
// form/xG/h2h/intangibles and the rules that need them simply don't fire.

const emptyForm = (teamId: TeamId, lastN: number): TeamForm => ({
  teamId,
  lastN,
  games: [],
  goalsFor: 0,
  goalsAgainst: 0,
  cleanSheets: 0,
  bttsRate: 0,
  ppgLast: 0,
});

const emptyH2H = (homeId: TeamId, awayId: TeamId): H2H => ({
  homeId,
  awayId,
  meetings: [],
  homeWins: 0,
  awayWins: 0,
  draws: 0,
  averageGoals: 0,
});

const emptyIntangibles = (matchId: MatchId): Intangibles => ({
  matchId,
  homeInjuries: [],
  awayInjuries: [],
});

export const createNullHistoryProvider = (): HistoryProvider => ({
  name: "none",
  async getForm(teamId, lastN) {
    return emptyForm(teamId, lastN);
  },
  async getH2H(homeId, awayId) {
    return emptyH2H(homeId, awayId);
  },
  async getIntangibles(matchId) {
    return emptyIntangibles(matchId);
  },
});
