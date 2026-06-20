import type { H2H, Intangibles, TeamForm } from "@/domain/history";
import type { Match } from "@/domain/match";
import type { MarketKey } from "@/domain/market";
import type { LineSnapshot } from "@/domain/odds";
import type { Splits } from "@/domain/splits";
import type { StrategyConfig } from "@/domain/strategy";

/**
 * Sport-agnostic analysis context. The generic pipeline only depends on these
 * fields, so any sport module can build its own context by extending this and
 * adding sport-specific data (form, lineups, surface, …). See
 * `src/sports/SportModule.ts`.
 */
export interface AnalysisContextBase {
  match: Match;
  strategy: StrategyConfig;
  unitBankrollFraction: number;
  userBooks: string[];
  generatedAt: string;
}

/**
 * Football analysis context — the default `TCtx` for the engine. Carries the
 * market lines + football-specific historical data the football rules read.
 */
export interface AnalysisContext extends AnalysisContextBase {
  lines: Partial<Record<MarketKey, LineSnapshot>>;
  openers: Partial<Record<MarketKey, LineSnapshot>>;
  splits: Partial<Record<MarketKey, Splits>>;
  homeForm?: TeamForm;
  awayForm?: TeamForm;
  h2h?: H2H;
  intangibles?: Intangibles;
}

export const DEFAULT_UNIT_BANKROLL_FRACTION = 0.01;
