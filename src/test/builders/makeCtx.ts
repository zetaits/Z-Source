import type { H2H, Intangibles, TeamForm } from "@/domain/history";
import { BookId, LeagueId, MatchId, TeamId } from "@/domain/ids";
import type { MarketKey, Selection } from "@/domain/market";
import type { BookOffer, LineSnapshot } from "@/domain/odds";
import type { Splits } from "@/domain/splits";
import {
  DEFAULT_LEG_WEIGHTS,
  DEFAULT_STAKE_POLICY,
  type StrategyConfig,
} from "@/domain/strategy";
import type { AnalysisContext } from "@/engine/context";
import { DEFAULT_UNIT_BANKROLL_FRACTION } from "@/engine/context";

export const DEFAULT_MARKETS: MarketKey[] = ["ML_1X2", "DNB", "AH", "OU_GOALS", "BTTS"];

const nowIso = () => "2026-04-14T10:00:00Z";

export const makeOffer = (
  selection: Selection,
  decimal: number,
  book = "pinnacle",
): BookOffer => ({
  book: BookId(book),
  selection,
  decimal,
  takenAt: nowIso(),
});

export const makeLineSnapshot = (
  marketKey: MarketKey,
  offers: BookOffer[],
  isOpener = false,
): LineSnapshot => ({
  matchId: MatchId("match-1"),
  marketKey,
  offers,
  takenAt: nowIso(),
  isOpener,
});

export const defaultStrategy = (overrides: Partial<StrategyConfig> = {}): StrategyConfig => ({
  legWeights: DEFAULT_LEG_WEIGHTS,
  stakePolicy: DEFAULT_STAKE_POLICY,
  rules: [],
  enabledMarkets: DEFAULT_MARKETS,
  ...overrides,
});

export interface CtxOverrides {
  lines?: Partial<Record<MarketKey, LineSnapshot>>;
  openers?: Partial<Record<MarketKey, LineSnapshot>>;
  splits?: Partial<Record<MarketKey, Splits>>;
  strategy?: StrategyConfig;
  unitBankrollFraction?: number;
  homeForm?: TeamForm;
  awayForm?: TeamForm;
  h2h?: H2H;
  intangibles?: Intangibles;
}

export const makeCtx = (overrides: CtxOverrides = {}): AnalysisContext => ({
  match: {
    id: MatchId("match-1"),
    leagueId: LeagueId("league-1"),
    kickoffAt: nowIso(),
    home: { id: TeamId("home"), name: "Home FC" },
    away: { id: TeamId("away"), name: "Away CF" },
    status: "SCHEDULED",
    source: "test",
  },
  strategy: overrides.strategy ?? defaultStrategy(),
  lines: overrides.lines ?? {},
  openers: overrides.openers ?? {},
  splits: overrides.splits ?? {},
  homeForm: overrides.homeForm,
  awayForm: overrides.awayForm,
  h2h: overrides.h2h,
  intangibles: overrides.intangibles,
  unitBankrollFraction: overrides.unitBankrollFraction ?? DEFAULT_UNIT_BANKROLL_FRACTION,
  generatedAt: nowIso(),
});

export const ml1x2Snapshot = (
  home: number,
  draw: number,
  away: number,
  isOpener = false,
): LineSnapshot =>
  makeLineSnapshot(
    "ML_1X2",
    [
      makeOffer({ marketKey: "ML_1X2", side: "home" }, home),
      makeOffer({ marketKey: "ML_1X2", side: "draw" }, draw),
      makeOffer({ marketKey: "ML_1X2", side: "away" }, away),
    ],
    isOpener,
  );

export const ouGoalsSnapshot = (
  line: number,
  over: number,
  under: number,
): LineSnapshot =>
  makeLineSnapshot("OU_GOALS", [
    makeOffer({ marketKey: "OU_GOALS", side: "over", line }, over),
    makeOffer({ marketKey: "OU_GOALS", side: "under", line }, under),
  ]);

export const bttsSnapshot = (yes: number, no: number): LineSnapshot =>
  makeLineSnapshot("BTTS", [
    makeOffer({ marketKey: "BTTS", side: "yes" }, yes),
    makeOffer({ marketKey: "BTTS", side: "no" }, no),
  ]);
