import { LeagueId } from "@/domain/ids";
import type { League } from "@/domain/match";

export interface LeagueDef extends League {
  oddsApiKey: string;
  sofaScoreId: number;
  defaultEnabled: boolean;
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
  },
  {
    id: LeagueId("laliga"),
    name: "LaLiga",
    countryCode: "ES",
    tier: 1,
    oddsApiKey: "soccer_spain_la_liga",
    sofaScoreId: 8,
    defaultEnabled: true,
  },
  {
    id: LeagueId("seriea"),
    name: "Serie A",
    countryCode: "IT",
    tier: 1,
    oddsApiKey: "soccer_italy_serie_a",
    sofaScoreId: 23,
    defaultEnabled: true,
  },
  {
    id: LeagueId("bundesliga"),
    name: "Bundesliga",
    countryCode: "DE",
    tier: 1,
    oddsApiKey: "soccer_germany_bundesliga",
    sofaScoreId: 35,
    defaultEnabled: true,
  },
  {
    id: LeagueId("ligue1"),
    name: "Ligue 1",
    countryCode: "FR",
    tier: 1,
    oddsApiKey: "soccer_france_ligue_one",
    sofaScoreId: 34,
    defaultEnabled: true,
  },
  {
    id: LeagueId("eredivisie"),
    name: "Eredivisie",
    countryCode: "NL",
    tier: 1,
    oddsApiKey: "soccer_netherlands_eredivisie",
    sofaScoreId: 37,
    defaultEnabled: false,
  },
  {
    id: LeagueId("primeira"),
    name: "Primeira Liga",
    countryCode: "PT",
    tier: 1,
    oddsApiKey: "soccer_portugal_primeira_liga",
    sofaScoreId: 238,
    defaultEnabled: false,
  },
  {
    id: LeagueId("championship"),
    name: "Championship",
    countryCode: "GB-ENG",
    tier: 2,
    oddsApiKey: "soccer_efl_champ",
    sofaScoreId: 18,
    defaultEnabled: false,
  },
  {
    id: LeagueId("ucl"),
    name: "UEFA Champions League",
    countryCode: "EU",
    tier: 0,
    oddsApiKey: "soccer_uefa_champs_league",
    sofaScoreId: 7,
    defaultEnabled: true,
  },
  {
    id: LeagueId("uel"),
    name: "UEFA Europa League",
    countryCode: "EU",
    tier: 0,
    oddsApiKey: "soccer_uefa_europa_league",
    sofaScoreId: 679,
    defaultEnabled: false,
  },
  {
    id: LeagueId("mls"),
    name: "MLS",
    countryCode: "US",
    tier: 1,
    oddsApiKey: "soccer_usa_mls",
    sofaScoreId: 242,
    defaultEnabled: false,
  },
  {
    id: LeagueId("ligamx"),
    name: "Liga MX",
    countryCode: "MX",
    tier: 1,
    oddsApiKey: "soccer_mexico_ligamx",
    sofaScoreId: 11621,
    defaultEnabled: false,
  },
  {
    id: LeagueId("brasileirao"),
    name: "Brasileirão Série A",
    countryCode: "BR",
    tier: 1,
    oddsApiKey: "soccer_brazil_campeonato",
    sofaScoreId: 325,
    defaultEnabled: false,
  },
  {
    id: LeagueId("argentina"),
    name: "Liga Profesional Argentina",
    countryCode: "AR",
    tier: 1,
    oddsApiKey: "soccer_argentina_primera_division",
    sofaScoreId: 155,
    defaultEnabled: false,
  },
];

export const findLeagueByOddsKey = (key: string): LeagueDef | undefined =>
  LEAGUES.find((l) => l.oddsApiKey === key);

export const findLeagueBySofa = (id: number): LeagueDef | undefined =>
  LEAGUES.find((l) => l.sofaScoreId === id);

export const findLeagueById = (id: string): LeagueDef | undefined =>
  LEAGUES.find((l) => l.id === id);
