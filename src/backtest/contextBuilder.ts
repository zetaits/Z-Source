/**
 * Reconstruct AnalysisContext from historical CSV data. Football-data.co.uk
 * does not expose xG, splits, openers or intangibles — so xG-based rules,
 * splits-based rules and openers-based rules will skip silently. The backtest
 * therefore primarily validates: vigAdjustedEdge, drawValueAt375, goalsTempoForm,
 * h2hDominance pattern mode, formDivergence, restCongestion (limited), and
 * verdict ordinal (STRONG ≥ PLAY ≥ LEAN hit-rate).
 */
import { LeagueId, MatchId, TeamId } from "@/domain/ids";
import type { H2H, TeamForm, TeamFormGame } from "@/domain/history";
import type { Match } from "@/domain/match";
import type { MarketKey, Selection } from "@/domain/market";
import type { BookOffer, LineSnapshot } from "@/domain/odds";
import type { StrategyConfig } from "@/domain/strategy";
import { BookId } from "@/domain/ids";
import {
  DEFAULT_UNIT_BANKROLL_FRACTION,
  type AnalysisContext,
} from "@/engine/context";
import {
  historicalOddsRepo,
  type HistoricalMatch,
  type HistoricalOffer,
} from "@/storage/repos/historicalOddsRepo";

const FORM_LAST_N = 6;
const H2H_LAST_N = 8;

const teamIdFor = (name: string): TeamId => TeamId(name);

const offerToBookOffer = (o: HistoricalOffer): BookOffer => ({
  book: BookId(o.book),
  selection: {
    marketKey: o.marketKey,
    side: o.selectionSide,
    line: o.line ?? undefined,
  } as Selection,
  decimal: o.decimal,
  takenAt: "",
});

const groupOffersByMarket = (
  offers: HistoricalOffer[],
  matchId: MatchId,
  takenAt: string,
): Partial<Record<MarketKey, LineSnapshot>> => {
  const out: Partial<Record<MarketKey, LineSnapshot>> = {};
  for (const o of offers) {
    const existing = out[o.marketKey];
    const bookOffer = { ...offerToBookOffer(o), takenAt };
    if (existing) {
      existing.offers.push(bookOffer);
    } else {
      out[o.marketKey] = {
        matchId,
        marketKey: o.marketKey,
        offers: [bookOffer],
        takenAt,
      };
    }
  }
  return out;
};

const matchResult = (m: HistoricalMatch, teamName: string): "W" | "D" | "L" => {
  const isHome = m.homeTeam === teamName;
  const diff = m.fthg - m.ftag;
  if (diff === 0) return "D";
  if ((isHome && diff > 0) || (!isHome && diff < 0)) return "W";
  return "L";
};

const matchToFormGame = (
  m: HistoricalMatch,
  teamName: string,
): TeamFormGame => {
  const isHome = m.homeTeam === teamName;
  const goalsFor = isHome ? m.fthg : m.ftag;
  const goalsAgainst = isHome ? m.ftag : m.fthg;
  const opponent = isHome ? m.awayTeam : m.homeTeam;
  return {
    matchId: MatchId(m.id),
    date: m.date,
    opponentId: teamIdFor(opponent),
    opponentName: opponent,
    isHome,
    goalsFor,
    goalsAgainst,
    result: matchResult(m, teamName),
  };
};

const aggregateForm = (
  teamName: string,
  games: TeamFormGame[],
): TeamForm => {
  const goalsFor = games.reduce((s, g) => s + g.goalsFor, 0);
  const goalsAgainst = games.reduce((s, g) => s + g.goalsAgainst, 0);
  const cleanSheets = games.filter((g) => g.goalsAgainst === 0).length;
  const btts = games.filter((g) => g.goalsFor > 0 && g.goalsAgainst > 0).length;
  const points = games.reduce(
    (s, g) => s + (g.result === "W" ? 3 : g.result === "D" ? 1 : 0),
    0,
  );
  const lastN = games.length;
  return {
    teamId: teamIdFor(teamName),
    lastN,
    games,
    goalsFor,
    goalsAgainst,
    cleanSheets,
    bttsRate: lastN > 0 ? btts / lastN : 0,
    ppgLast: lastN > 0 ? points / lastN : 0,
    pointsLast: points,
  };
};

export interface BacktestCtxOpts {
  match: HistoricalMatch;
  priorMatches: HistoricalMatch[]; // previous matches in same league, before this match's date
  strategy: StrategyConfig;
}

export const buildBacktestContext = async (
  opts: BacktestCtxOpts,
): Promise<AnalysisContext> => {
  const { match, priorMatches, strategy } = opts;
  const offers = await historicalOddsRepo.offersFor(match.id);
  const matchId = MatchId(match.id);
  const lines = groupOffersByMarket(offers, matchId, match.date);

  const homeRecent = priorMatches
    .filter(
      (m) =>
        (m.homeTeam === match.homeTeam || m.awayTeam === match.homeTeam) &&
        m.date < match.date,
    )
    .slice(-FORM_LAST_N)
    .map((m) => matchToFormGame(m, match.homeTeam));

  const awayRecent = priorMatches
    .filter(
      (m) =>
        (m.homeTeam === match.awayTeam || m.awayTeam === match.awayTeam) &&
        m.date < match.date,
    )
    .slice(-FORM_LAST_N)
    .map((m) => matchToFormGame(m, match.awayTeam));

  const h2hMeetings = priorMatches
    .filter(
      (m) =>
        ((m.homeTeam === match.homeTeam && m.awayTeam === match.awayTeam) ||
          (m.homeTeam === match.awayTeam && m.awayTeam === match.homeTeam)) &&
        m.date < match.date,
    )
    .slice(-H2H_LAST_N)
    .map((m) => matchToFormGame(m, match.homeTeam));

  const h2h: H2H = {
    homeId: teamIdFor(match.homeTeam),
    awayId: teamIdFor(match.awayTeam),
    meetings: h2hMeetings,
    homeWins: h2hMeetings.filter((g) => g.result === "W").length,
    awayWins: h2hMeetings.filter((g) => g.result === "L").length,
    draws: h2hMeetings.filter((g) => g.result === "D").length,
    averageGoals:
      h2hMeetings.length > 0
        ? h2hMeetings.reduce((s, g) => s + g.goalsFor + g.goalsAgainst, 0) /
          h2hMeetings.length
        : 0,
  };

  const engineMatch: Match = {
    id: matchId,
    leagueId: LeagueId(match.league),
    kickoffAt: match.date,
    home: { id: teamIdFor(match.homeTeam), name: match.homeTeam },
    away: { id: teamIdFor(match.awayTeam), name: match.awayTeam },
    status: "FT",
    source: "backtest",
  };

  return {
    match: engineMatch,
    strategy,
    lines,
    openers: {},
    splits: {},
    homeForm: aggregateForm(match.homeTeam, homeRecent),
    awayForm: aggregateForm(match.awayTeam, awayRecent),
    h2h,
    intangibles: undefined,
    unitBankrollFraction: DEFAULT_UNIT_BANKROLL_FRACTION,
    userBooks: [],
    generatedAt: match.date,
  };
};
