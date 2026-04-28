import type { H2H, Intangibles, TeamForm } from "@/domain/history";
import type { Match } from "@/domain/match";
import type { MarketKey } from "@/domain/market";
import type { LineSnapshot } from "@/domain/odds";
import type { Splits } from "@/domain/splits";
import type { StrategyConfig } from "@/domain/strategy";

export interface AnalysisContext {
  match: Match;
  strategy: StrategyConfig;
  lines: Partial<Record<MarketKey, LineSnapshot>>;
  openers: Partial<Record<MarketKey, LineSnapshot>>;
  splits: Partial<Record<MarketKey, Splits>>;
  homeForm?: TeamForm;
  awayForm?: TeamForm;
  h2h?: H2H;
  intangibles?: Intangibles;
  unitBankrollFraction: number;
  userBooks: string[];
  generatedAt: string;
}

export const DEFAULT_UNIT_BANKROLL_FRACTION = 0.01;
