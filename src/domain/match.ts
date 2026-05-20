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
  home: { name: string; aliases?: string[]; sofaScoreId?: number; fdorgTeamId?: number };
  away: { name: string; aliases?: string[]; sofaScoreId?: number; fdorgTeamId?: number };
  status: MatchStatus;
  fdorgMatchId?: number;
}

export interface CatalogMatchDetails {
  match: CatalogMatch;
  venue?: string;
  weather?: { tempC?: number; condition?: string; windKph?: number };
  referee?: string;
  lineupsAvailable?: boolean;
  raw?: Record<string, unknown>;
}

/**
 * Common particles and noise to filter out from team names to get to the "core" name.
 */
const TEAM_NOISE = new Set([
  "FC", "SC", "VFL", "AFC", "AS", "SS", "RC", "SV", "TSV", "UD", "CD", "CF", "FSV",
  "1.", "04", "07", "09", "II", "B", "U23", "U21", "U19"
]);

/**
 * Extracts a punchy, single-word (usually) identifier for a team.
 * Best for high-impact HERO blocks or limited space.
 * Example: "VFL Wolfsburg" -> "Wolfsburg", "SC Paderborn 07" -> "Paderborn"
 */
export function getTeamPunchyName(name: string): string {
  if (!name) return "—";
  const parts = name.split(" ");
  if (parts.length === 1) return name;

  const filtered = parts.filter(p => !TEAM_NOISE.has(p.toUpperCase()) && !/^\d+$/.test(p));
  
  if (filtered.length === 0) return parts[parts.length - 1];
  
  // Return the last significant word
  return filtered[filtered.length - 1];
}

/**
 * Returns a middle-ground name that is shorter than the full name but more
 * descriptive than the punchy name. Currently just filters noise but keeps more words.
 * Example: "Manchester United" -> "Manchester United" (vs punchy "United")
 */
export function getTeamShortName(name: string): string {
  if (!name) return "—";
  const parts = name.split(" ");
  if (parts.length === 1) return name;

  const filtered = parts.filter(p => !TEAM_NOISE.has(p.toUpperCase()));
  if (filtered.length === 0) return parts[0];

  return filtered.join(" ");
}

/**
 * Returns the single character to be used in a team crest.
 */
export function getTeamCrestLetter(name: string): string {
  const punchy = getTeamPunchyName(name);
  return punchy.charAt(0).toUpperCase();
}
