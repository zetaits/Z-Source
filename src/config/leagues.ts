import { LeagueId } from "@/domain/ids";
import type { League } from "@/domain/match";
import { getDiscovered } from "@/services/catalog/discoveredLeagues";

export interface LeagueDef extends League {
  oddsApiKey: string;
  sofaScoreId: number;
  defaultEnabled: boolean;
  footballDataCode?: string;
  // odds-api.io league slugs. Array because some competitions split into
  // seasonal stages (e.g. Liga MX Clausura/Apertura) with different slugs.
  oddsApiIoSlugs?: string[];
  // True for leagues discovered at runtime from the odds provider's catalog
  // (not part of the curated static list). These carry only an odds-api.io slug
  // — no the-odds-api key, SofaScore id, or football-data code.
  discovered?: boolean;
  // Upcoming-event count reported by the discovery source (popularity signal).
  eventsCount?: number;
}

export const LEAGUES: LeagueDef[] = [
  {
    id: LeagueId("epl"),
    name: "Premier League",
    countryCode: "GB-ENG",
    tier: 1,
    oddsApiKey: "soccer_epl",
    sofaScoreId: 17,
    defaultEnabled: true,
    footballDataCode: "PL",
    oddsApiIoSlugs: ["england-premier-league"],
  },
  {
    id: LeagueId("laliga"),
    name: "LaLiga",
    countryCode: "ES",
    tier: 1,
    oddsApiKey: "soccer_spain_la_liga",
    sofaScoreId: 8,
    defaultEnabled: true,
    footballDataCode: "PD",
    oddsApiIoSlugs: ["spain-laliga"],
  },
  {
    id: LeagueId("seriea"),
    name: "Serie A",
    countryCode: "IT",
    tier: 1,
    oddsApiKey: "soccer_italy_serie_a",
    sofaScoreId: 23,
    defaultEnabled: true,
    footballDataCode: "SA",
    oddsApiIoSlugs: ["italy-serie-a"],
  },
  {
    id: LeagueId("bundesliga"),
    name: "Bundesliga",
    countryCode: "DE",
    tier: 1,
    oddsApiKey: "soccer_germany_bundesliga",
    sofaScoreId: 35,
    defaultEnabled: true,
    footballDataCode: "BL1",
    oddsApiIoSlugs: ["germany-bundesliga"],
  },
  {
    id: LeagueId("ligue1"),
    name: "Ligue 1",
    countryCode: "FR",
    tier: 1,
    oddsApiKey: "soccer_france_ligue_one",
    sofaScoreId: 34,
    defaultEnabled: true,
    footballDataCode: "FL1",
    oddsApiIoSlugs: ["france-ligue-1"],
  },
  {
    id: LeagueId("eredivisie"),
    name: "Eredivisie",
    countryCode: "NL",
    tier: 1,
    oddsApiKey: "soccer_netherlands_eredivisie",
    sofaScoreId: 37,
    defaultEnabled: false,
    footballDataCode: "DED",
    oddsApiIoSlugs: ["netherlands-eredivisie"],
  },
  {
    id: LeagueId("primeira"),
    name: "Primeira Liga",
    countryCode: "PT",
    tier: 1,
    oddsApiKey: "soccer_portugal_primeira_liga",
    sofaScoreId: 238,
    defaultEnabled: false,
    footballDataCode: "PPL",
  },
  {
    id: LeagueId("championship"),
    name: "Championship",
    countryCode: "GB-ENG",
    tier: 2,
    oddsApiKey: "soccer_efl_champ",
    sofaScoreId: 18,
    defaultEnabled: false,
    footballDataCode: "ELC",
    oddsApiIoSlugs: ["england-championship"],
  },
  {
    id: LeagueId("ucl"),
    name: "UEFA Champions League",
    countryCode: "EU",
    tier: 0,
    oddsApiKey: "soccer_uefa_champs_league",
    sofaScoreId: 7,
    defaultEnabled: true,
    footballDataCode: "CL",
    oddsApiIoSlugs: ["international-clubs-uefa-champions-league"],
  },
  {
    id: LeagueId("uel"),
    name: "UEFA Europa League",
    countryCode: "EU",
    tier: 0,
    oddsApiKey: "soccer_uefa_europa_league",
    sofaScoreId: 679,
    defaultEnabled: false,
    oddsApiIoSlugs: ["international-clubs-uefa-europa-league"],
  },
  {
    id: LeagueId("uecl"),
    name: "UEFA Europa Conference League",
    countryCode: "EU",
    tier: 0,
    oddsApiKey: "soccer_uefa_europa_conference_league",
    sofaScoreId: 17015,
    defaultEnabled: false,
    oddsApiIoSlugs: ["international-clubs-uefa-conference-league"],
  },
  {
    id: LeagueId("worldcup"),
    name: "FIFA World Cup",
    countryCode: "INT",
    tier: 0,
    // sportKey is ignored by the odds-api.io provider (it lists all football
    // events globally and fuzzy-matches by team name); kept for correctness.
    oddsApiKey: "soccer_fifa_world_cup",
    sofaScoreId: 16,
    defaultEnabled: true,
    // Routes fixtures through the odds-api.io catalog, so every surfaced match
    // is priceable by construction. Slug verified live (63 events, 2026 cycle).
    oddsApiIoSlugs: ["international-fifa-world-cup"],
  },
  {
    id: LeagueId("mls"),
    name: "MLS",
    countryCode: "US",
    tier: 1,
    oddsApiKey: "soccer_usa_mls",
    sofaScoreId: 242,
    defaultEnabled: false,
    oddsApiIoSlugs: ["usa-mls"],
  },
  {
    id: LeagueId("ligamx"),
    name: "Liga MX",
    countryCode: "MX",
    tier: 1,
    oddsApiKey: "soccer_mexico_ligamx",
    sofaScoreId: 11621,
    defaultEnabled: false,
    oddsApiIoSlugs: ["mexico-liga-mx-clausura", "mexico-liga-mx-apertura", "mexico-liga-mx"],
  },
  {
    id: LeagueId("brasileirao"),
    name: "Brasileirão Série A",
    countryCode: "BR",
    tier: 1,
    oddsApiKey: "soccer_brazil_campeonato",
    sofaScoreId: 325,
    defaultEnabled: false,
    oddsApiIoSlugs: ["brazil-brasileiro-serie-a"],
  },
  {
    id: LeagueId("argentina"),
    name: "Liga Profesional Argentina",
    countryCode: "AR",
    tier: 1,
    oddsApiKey: "soccer_argentina_primera_division",
    sofaScoreId: 155,
    defaultEnabled: false,
    oddsApiIoSlugs: ["argentina-liga-profesional"],
  },
];

// Curated leagues + runtime-discovered ones. Curated entries always take
// precedence (they carry the full cross-provider mapping); discovery drops any
// candidate that collides with a curated slug before registering.
export const allLeagues = (): LeagueDef[] => [...LEAGUES, ...getDiscovered()];

export const findLeagueByOddsKey = (key: string): LeagueDef | undefined =>
  LEAGUES.find((l) => l.oddsApiKey === key);

// SofaScore ids only exist on curated leagues; discovered ones use 0 as a
// sentinel, so guard against a spurious match on 0.
export const findLeagueBySofa = (id: number): LeagueDef | undefined =>
  id ? LEAGUES.find((l) => l.sofaScoreId === id) : undefined;

export const findLeagueById = (id: string): LeagueDef | undefined =>
  LEAGUES.find((l) => l.id === id) ?? getDiscovered().find((l) => l.id === id);
