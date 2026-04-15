import type { LeagueId, MatchId, TeamId } from "./ids";

export type MatchStatus = "SCHEDULED" | "LIVE" | "FT" | "POSTPONED" | "CANCELLED";

export interface Team {
  id: TeamId;
  name: string;
  shortName?: string;
  aliases?: string[];
  countryCode?: string;
}

export interface League {
  id: LeagueId;
  name: string;
  countryCode: string;
  tier: number;
  oddsApiKey?: string;
  sofaScoreId?: number;
}

export interface Match {
  id: MatchId;
  leagueId: LeagueId;
  kickoffAt: string;
  home: Team;
  away: Team;
  status: MatchStatus;
  source: string;
}

export interface CatalogMatch {
  catalogId: string;
  source: string;
  leagueId: LeagueId;
  leagueName: string;
  countryCode: string;
  kickoffAt: string;
  home: { name: string; aliases?: string[] };
  away: { name: string; aliases?: string[] };
  status: MatchStatus;
}

export interface CatalogMatchDetails {
  match: CatalogMatch;
  venue?: string;
  weather?: { tempC?: number; condition?: string; windKph?: number };
  referee?: string;
  lineupsAvailable?: boolean;
  raw?: Record<string, unknown>;
}
