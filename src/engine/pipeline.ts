import { PlayId } from "@/domain/ids";
import type { PlayCandidate, Verdict } from "@/domain/play";
import type { ReasoningEntry } from "@/domain/trace";
import type { AnalysisContext } from "./context";
import { combine } from "./combine";
import { clamp, edgePct } from "./ev";
import { MARKET_ADAPTERS } from "./markets";
import { RULES } from "./rules";
import { sizeStakeUnits } from "./stake";
import type { MarketAdapter, Rule, RuleOutput } from "./types";

const uid = (): string =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `play_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

const deriveVerdict = (edge: number, confidence: number): Verdict => {
  if (edge >= 0.08 && confidence >= 0.7) return "STRONG";
  if (edge >= 0.04 && confidence >= 0.5) return "PLAY";
  if (edge >= 0.02) return "LEAN";
  return "PASS";
};

const ruleApplies = (rule: Rule, marketKey: string): boolean =>
  rule.markets === "*" || rule.markets.includes(marketKey as never);

const outputToEntry = (o: RuleOutput): ReasoningEntry => ({
  source: "rule",
  id: o.ruleId,
  verdict: o.verdict,
  weight: o.weight,
  message: o.message,
  data: o.data,
});

export interface RunOptions {
  includePass?: boolean;
}

export const runBondedAnalysis = (
  ctx: AnalysisContext,
  opts: RunOptions = {},
): PlayCandidate[] => {
  const strategy = ctx.strategy;
  const ruleConfigs = new Map(strategy.rules.map((r) => [r.ruleId, r]));
  const activeRules = RULES.filter((r) => {
    const cfg = ruleConfigs.get(r.id);
    return cfg ? cfg.enabled : true;
  });

  const adapters: MarketAdapter[] = MARKET_ADAPTERS.filter((a) =>
    strategy.enabledMarkets.includes(a.key),
  );

  const candidates: PlayCandidate[] = [];

  for (const adapter of adapters) {
    for (const selection of adapter.enumerate(ctx)) {
      const price = adapter.bestPrice(selection, ctx);
      const baseProb = adapter.vigFreeProb(selection, ctx);
      if (!price || baseProb === undefined) continue;

      const outputs: RuleOutput[] = [];
      for (const rule of activeRules) {
        if (!ruleApplies(rule, selection.marketKey)) continue;
        const cfg = ruleConfigs.get(rule.id) ?? {
          ruleId: rule.id,
          enabled: true,
          weight: rule.defaultWeight,
        };
        const out = rule.run({
          ctx,
          selection,
          market: adapter,
          config: cfg,
          baseProb,
          price,
        });
        if (out) outputs.push(out);
      }

      const combined = combine(outputs, baseProb, strategy.legWeights);
      const edge = edgePct(combined.fairProb, price.decimal);
      const verdict = deriveVerdict(edge, combined.confidence);

      if (verdict === "PASS" && !opts.includePass) continue;

      const policy = strategy.stakePolicy;
      const meetsThreshold =
        edge >= policy.minEdgePct && combined.confidence >= policy.minConfidence;
      const stakeUnits = meetsThreshold
        ? sizeStakeUnits({
            policy,
            fairProb: combined.fairProb,
            priceDecimal: price.decimal,
            confidence: combined.confidence,
            unitBankrollFraction: ctx.unitBankrollFraction,
          })
        : 0;

      const trace: ReasoningEntry[] = [
        {
          source: "adapter",
          id: adapter.key,
          verdict: "NEUTRAL",
          weight: 1,
          message: `${adapter.label} · vig-free prob ${(baseProb * 100).toFixed(1)}% @ ${price.decimal.toFixed(2)}`,
          data: { baseProb, priceDecimal: price.decimal, book: price.book },
        },
        ...outputs.map(outputToEntry),
        {
          source: "math",
          id: "combined",
          verdict: combined.overallSignal > 0 ? "SUPPORT" : combined.overallSignal < 0 ? "AGAINST" : "NEUTRAL",
          weight: 1,
          message: `Fair prob ${(combined.fairProb * 100).toFixed(1)}% · edge ${(edge * 100).toFixed(2)}% · confidence ${(combined.confidence * 100).toFixed(0)}%`,
          data: {
            perLegSignal: combined.perLegSignal,
            overallSignal: combined.overallSignal,
            fairProb: combined.fairProb,
            edgePct: edge,
            confidence: combined.confidence,
          },
        },
      ];

      candidates.push({
        id: PlayId(uid()),
        matchId: ctx.match.id,
        selection,
        price,
        edgePct: edge,
        fairProb: combined.fairProb,
        confidence: clamp(combined.confidence, 0, 1),
        stakeUnits,
        verdict,
        trace,
        generatedAt: ctx.generatedAt,
      });
    }
  }

  candidates.sort((a, b) => b.edgePct - a.edgePct);
  return candidates;
};
