// ============================================================================
// Z-SOURCE — SPORT MODULE CONTRACTS
// ----------------------------------------------------------------------------
// A SportModule is the plugin every sport implements. The app core (fixtures,
// analysis, settings, UI) is sport-agnostic and delegates to the module of the
// active sport. To add a sport: implement this contract and register it in
// `src/sports/registry.ts`. See `src/config/sports.ts` for the UI-side registry
// (terminology, rail order) — module `id` MUST match a `Sport.id` there.
//
// Shared across all sports: the odds feed (odds-api.io). Everything else —
// fixtures source, historical data, market catalog, analysis algorithms — is
// owned by the module so each sport can fetch and reason however it needs.
// ============================================================================

import type { CatalogMatch } from "@/domain/match";
import type { MarketKey } from "@/domain/market";
import type { LineSnapshot } from "@/domain/odds";
import type { ComboPlay, PlayCandidate } from "@/domain/play";
import type { Splits } from "@/domain/splits";
import type { H2H, Intangibles, TeamForm } from "@/domain/history";
import type { StrategyConfig } from "@/domain/strategy";
import type { AnalysisContextBase, EngineBundle } from "@/engine";
import type { AnalysisDiagnostics } from "@/engine";
import type { SyntheticPrice } from "@/engine/synthetic";
import type { OddsProviderId } from "@/services/settings/settingsStore";
import type { OddsProvider } from "@/services/providers/OddsProvider";
import type { HistoryProvider } from "@/services/providers/HistoryProvider";
import type { SplitProvider } from "@/services/providers/SplitProvider";

export type AnalysisStatus =
  | "ok"
  | "no-api-key"
  | "no-engine"
  | "unresolved"
  | "empty-odds"
  | "error";

export interface ResolutionInfo {
  oddsProviderId: OddsProviderId;
  oddsEventId: string | null;
  confidence: number;
  resolvedAt: string;
}

/**
 * Canonical analysis result shape returned by every SportModule. Sports
 * populate only the fields they have — e.g. a sport with no engine yet returns
 * empty plays with `status: "no-engine"`; football fills form/h2h/synthetic.
 */
export interface AnalysisResult {
  plays: PlayCandidate[];
  /** All evaluated selections including PASS — used for the closest-to-threshold rail and odds-board edge overlay. */
  allCandidates: PlayCandidate[];
  combos: ComboPlay[];
  diagnostics?: AnalysisDiagnostics;
  lines: Partial<Record<MarketKey, LineSnapshot>>;
  openers: Partial<Record<MarketKey, LineSnapshot>>;
  synthetic: Partial<Record<MarketKey, SyntheticPrice[]>>;
  splits: Partial<Record<MarketKey, Splits>>;
  splitsAvailable: boolean;
  splitsProvider: string;
  homeForm?: TeamForm;
  awayForm?: TeamForm;
  h2h?: H2H;
  intangibles?: Intangibles;
  historyAvailable: boolean;
  historyProvider: string;
  strategy: StrategyConfig;
  status: AnalysisStatus;
  message?: string;
  resolution?: ResolutionInfo;
  generatedAt: string;
}

export interface AnalyzeArgs {
  match: CatalogMatch;
  signal?: AbortSignal;
  forceRefresh?: boolean;
}

/** Which data feeds a sport has wired. Drives UI capability hints. */
export interface SportDataCapabilities {
  catalog: boolean;
  odds: boolean;
  history: boolean;
  splits: boolean;
}

export interface SportProviders {
  odds: OddsProvider;
  history?: HistoryProvider;
  splits?: SplitProvider;
}

/**
 * One fixtures feed. A sport can expose several (football merges fdorg +
 * odds-api.io + sofascore for progressive loading); each gets its own
 * React Query entry. `key` MUST be unique per source AND per sport.
 */
export interface SportFixtureSource {
  key: readonly unknown[];
  fetch: () => Promise<CatalogMatch[]>;
}

export interface SportModule {
  /** Matches `Sport.id` in config/sports.ts. */
  readonly id: string;
  /** odds-api.io sport slug; null until odds are wired for this sport. */
  readonly oddsSlug: string | null;
  readonly capabilities: SportDataCapabilities;
  /** Adapters + rules. Empty adapters => no analysis engine yet. */
  readonly engine: EngineBundle<AnalysisContextBase>;
  /** Fixtures feeds for the upcoming-window list. Empty => no fixtures yet. */
  fixtureSources(): SportFixtureSource[];
  /** Produce the full analysis for one fixture. */
  analyze(args: AnalyzeArgs): Promise<AnalysisResult>;
}
