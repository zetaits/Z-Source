import type { MarketKey, Selection } from "@/domain/market";
import type { Price } from "@/domain/odds";
import type { Leg, RuleConfig } from "@/domain/strategy";
import type { ReasoningVerdict } from "@/domain/trace";
import type { AnalysisContext } from "./context";

export interface MarketAdapter {
  key: MarketKey;
  label: string;
  enumerate(ctx: AnalysisContext): Selection[];
  bestPrice(selection: Selection, ctx: AnalysisContext): Price | undefined;
  vigFreeProb(selection: Selection, ctx: AnalysisContext): number | undefined;
}

export interface RuleOutput {
  ruleId: string;
  leg: Leg;
  verdict: ReasoningVerdict;
  strength: number;
  weight: number;
  message: string;
  data?: Record<string, unknown>;
}

export interface RuleContext {
  ctx: AnalysisContext;
  selection: Selection;
  market: MarketAdapter;
  config: RuleConfig;
  baseProb: number;
  price: Price;
}

export interface Rule {
  id: string;
  description: string;
  markets: MarketKey[] | "*";
  leg: Leg;
  defaultWeight: number;
  run: (rc: RuleContext) => RuleOutput | null;
}
