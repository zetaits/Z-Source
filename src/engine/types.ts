import type { MarketKey, Selection } from "@/domain/market";
import type { Price } from "@/domain/odds";
import type { Leg, RuleConfig } from "@/domain/strategy";
import type { ReasoningVerdict } from "@/domain/trace";
import type { AnalysisContext, AnalysisContextBase } from "./context";

export interface MarketAdapter<TCtx extends AnalysisContextBase = AnalysisContext> {
  key: MarketKey;
  label: string;
  enumerate(ctx: TCtx): Selection[];
  bestPrice(selection: Selection, ctx: TCtx): Price | undefined;
  vigFreeProb(selection: Selection, ctx: TCtx): number | undefined;
}

export interface RuleOutput {
  ruleId: string;
  leg: Leg;
  verdict: ReasoningVerdict;
  strength: number;
  weight: number;
  message: string;
  data?: Record<string, unknown>;
  /** Optional family tag for decorrelation. Rules of the same family in the
   * same leg get a 1/√N discount applied to their contributions in combine(). */
  family?: string;
}

export interface RuleContext<TCtx extends AnalysisContextBase = AnalysisContext> {
  ctx: TCtx;
  selection: Selection;
  market: MarketAdapter<TCtx>;
  config: RuleConfig;
  baseProb: number;
  price: Price;
}

export interface Rule<TCtx extends AnalysisContextBase = AnalysisContext> {
  id: string;
  description: string;
  markets: MarketKey[] | "*";
  leg: Leg;
  defaultWeight: number;
  run: (rc: RuleContext<TCtx>) => RuleOutput | null;
}

/**
 * The unit a sport module hands the pipeline: its market adapters, rules, and an
 * optional `diagnose` hook that reports sport-specific "missing data" flags. An
 * empty `adapters` array means the sport has no analysis engine yet — the
 * pipeline returns no candidates.
 */
export interface EngineBundle<TCtx extends AnalysisContextBase = AnalysisContext> {
  adapters: MarketAdapter<TCtx>[];
  rules: Rule<TCtx>[];
  diagnose?: (ctx: TCtx) => DataMissingDiagnostics;
}

export interface DataMissingDiagnostics {
  homeForm: boolean;
  awayForm: boolean;
  homeXG: boolean;
  awayXG: boolean;
  splitsMissing: MarketKey[];
  openersMissing: MarketKey[];
  h2hMeetings: number;
  intangibles: boolean;
}
