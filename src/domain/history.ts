import type { MatchId, TeamId } from "./ids";

export type FormResult = "W" | "D" | "L";

export interface TeamFormGame {
  matchId: MatchId;
  date: string;
  opponentId: TeamId;
  opponentName: string;
  isHome: boolean;
  goalsFor: number;
  goalsAgainst: number;
  result: FormResult;
}

export interface TeamForm {
  teamId: TeamId;
  lastN: number;
  games: TeamFormGame[];
  goalsFor: number;
  goalsAgainst: number;
  cleanSheets: number;
  bttsRate: number;
  ppgLast: number;
}

export interface H2H {
  homeId: TeamId;
  awayId: TeamId;
  meetings: TeamFormGame[];
  homeWins: number;
  awayWins: number;
  draws: number;
  averageGoals: number;
}

export interface InjuryNote {
  player: string;
  status: "OUT" | "DOUBT" | "RETURNING";
  importance: "KEY" | "ROTATION" | "FRINGE";
  position?: string;
}

export interface Intangibles {
  matchId: MatchId;
  homeRestDays?: number;
  awayRestDays?: number;
  homeCongestion?: number;
  awayCongestion?: number;
  homeInjuries: InjuryNote[];
  awayInjuries: InjuryNote[];
  motivation?: { home?: string; away?: string };
  weather?: { tempC?: number; windKph?: number; condition?: string };
}
