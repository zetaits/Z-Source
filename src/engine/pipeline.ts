import { PlayId } from "@/domain/ids";
import type { MarketKey } from "@/domain/market";
import type { ComboPlay, PlayCandidate, Verdict } from "@/domain/play";
import { DEFAULT_COMBO_POLICY } from "@/domain/strategy";
import type { ReasoningEntry } from "@/domain/trace";
import type { AnalysisContext, AnalysisContextBase } from "./context";
import { combine, type BondedMeta } from "./combine";
import {
  enumerateAnchorCombos,
  enumerateCombos,
  type AnchorDiagnostics,
  type ComboDiagnostics,
} from "./combos";
import { clamp, edgePct } from "./ev";
import { MARKET_ADAPTERS } from "./markets";
import { RULES } from "./rules";
import { sizeStakeUnits } from "./stake";
import type {
  DataMissingDiagnostics,
  EngineBundle,
  MarketAdapter,
  RuleOutput,
} from "./types";

export interface AnalysisDiagnostics {
  selectionsEnumerated: number;
  selectionsSkipped: { noPrice: number; noBaseProb: number };
  verdictBreakdown: Record<Verdict, number>;
  rulesFired: Record<string, number>;
  rulesSkippedDataMissing: Record<string, number>;
  dataMissing: DataMissingDiagnostics;
  /** Set when the active sport has no analysis engine wired yet. */
  noEngine?: boolean;
  combos?: ComboDiagnostics;
  anchorCombos?: AnchorDiagnostics;
}

const EMPTY_DATA_MISSING: DataMissingDiagnostics = {
  homeForm: true,
  awayForm: true,
  homeXG: true,
  awayXG: true,
  splitsMissing: [],
  openersMissing: [],
  h2hMeetings: 0,
  intangibles: true,
};

/** Football-specific "missing data" diagnostics, read by DiagnosticsCard. */
export const footballDiagnose = (ctx: AnalysisContext): DataMissingDiagnostics => ({
  homeForm: !ctx.homeForm,
  awayForm: !ctx.awayForm,
  homeXG: ctx.homeForm?.xGForLast === undefined,
  awayXG: ctx.awayForm?.xGForLast === undefined,
  splitsMissing: ctx.strategy.enabledMarkets.filter((m) => !ctx.splits[m]),
  openersMissing: ctx.strategy.enabledMarkets.filter((m) => !ctx.openers[m]),
  h2hMeetings: ctx.h2h?.meetings.length ?? 0,
  intangibles: !ctx.intangibles,
});

/** Default engine bundle: the football adapters + rules. */
export const FOOTBALL_BUNDLE: EngineBundle<AnalysisContext> = {
  adapters: MARKET_ADAPTERS,
  rules: RULES,
  diagnose: footballDiagnose,
};

export interface BondedAnalysisResult {
  candidates: PlayCandidate[];
  combos: ComboPlay[];
  diagnostics: AnalysisDiagnostics;
}

const uid = (): string =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `play_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

const deriveVerdict = (
  edge: number,
  confidence: number,
  meta: BondedMeta,
  minLegsAligned: number,
): Verdict => {
  const bonded = meta.positiveLegsCount >= minLegsAligned && !meta.negativeStrong;
  if (edge >= 0.08 && confidence >= 0.7 && bonded) return "STRONG";
  if (edge >= 0.04 && confidence >= 0.5 && bonded) return "PLAY";
  if (edge >= 0.02 && meta.positiveLegsCount >= 2 && !meta.negativeStrong) return "LEAN";
  return "PASS";
};

const ruleApplies = (
  rule: { markets: MarketKey[] | "*" },
  marketKey: string,
): boolean => rule.markets === "*" || rule.markets.includes(marketKey as never);

const outputToEntry = (o: RuleOutput): ReasoningEntry => ({
  source: "rule",
  id: o.ruleId,
  verdict: o.verdict,
  weight: o.weight,
  message: o.message,
  data: o.data ? { ...o.data, leg: o.leg } : { leg: o.leg },
});

export interface RunOptions {
  includePass?: boolean;
}

export const runBondedAnalysis = <
  TCtx extends AnalysisContextBase = AnalysisContext,
>(
  ctx: TCtx,
  opts: RunOptions = {},
  bundle: EngineBundle<TCtx> = FOOTBALL_BUNDLE as unknown as EngineBundle<TCtx>,
): BondedAnalysisResult => {
  const strategy = ctx.strategy;
  const ruleConfigs = new Map(strategy.rules.map((r) => [r.ruleId, r]));
  const activeRules = bundle.rules.filter((r) => {
    const cfg = ruleConfigs.get(r.id);
    return cfg ? cfg.enabled : true;
  });

  const adapters: MarketAdapter<TCtx>[] = bundle.adapters.filter((a) =>
    strategy.enabledMarkets.includes(a.key),
  );

  const candidates: PlayCandidate[] = [];
  const diagnostics: AnalysisDiagnostics = {
    selectionsEnumerated: 0,
    selectionsSkipped: { noPrice: 0, noBaseProb: 0 },
    verdictBreakdown: { PASS: 0, LEAN: 0, PLAY: 0, STRONG: 0 },
    rulesFired: {},
    rulesSkippedDataMissing: {},
    dataMissing: bundle.diagnose ? bundle.diagnose(ctx) : { ...EMPTY_DATA_MISSING },
    noEngine: bundle.adapters.length === 0,
  };

  for (const adapter of adapters) {
    for (const selection of adapter.enumerate(ctx)) {
      diagnostics.selectionsEnumerated++;
      const price = adapter.bestPrice(selection, ctx);
      const baseProb = adapter.vigFreeProb(selection, ctx);
      if (!price) {
        diagnostics.selectionsSkipped.noPrice++;
        continue;
      }
      if (baseProb === undefined) {
        diagnostics.selectionsSkipped.noBaseProb++;
        continue;
      }

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
        if (out) {
          outputs.push(out);
          diagnostics.rulesFired[rule.id] = (diagnostics.rulesFired[rule.id] ?? 0) + 1;
        } else {
          diagnostics.rulesSkippedDataMissing[rule.id] =
            (diagnostics.rulesSkippedDataMissing[rule.id] ?? 0) + 1;
        }
      }

      const combined = combine(outputs, baseProb, strategy.legWeights, strategy.legCaps);
      const edge = edgePct(combined.fairProb, price.decimal);
      const verdict = deriveVerdict(
        edge,
        combined.confidence,
        combined.meta,
        strategy.minLegsAlignedForBonded,
      );
      diagnostics.verdictBreakdown[verdict]++;

      if (verdict === "PASS" && !opts.includePass) continue;

      const policy = strategy.stakePolicy;
      const meetsThreshold =
        edge >= policy.minEdgePct && combined.confidence >= policy.minConfidence;

      const bonded =
        combined.meta.positiveLegsCount >= strategy.minLegsAlignedForBonded &&
        !combined.meta.negativeStrong;

      const baseStake = meetsThreshold
        ? sizeStakeUnits({
            policy,
            fairProb: combined.fairProb,
            priceDecimal: price.decimal,
            confidence: combined.confidence,
            unitBankrollFraction: ctx.unitBankrollFraction,
          })
        : 0;
      const unbondedFactor = policy.unbondedFactor ?? 0.5;
      const stakeUnits = bonded ? baseStake : baseStake * unbondedFactor;

      const bookFilterFallback =
        ctx.userBooks.length > 0 && !ctx.userBooks.includes(price.book);

      const trace: ReasoningEntry[] = [
        {
          source: "adapter",
          id: adapter.key,
          verdict: "NEUTRAL",
          weight: 1,
          message: `${adapter.label} · vig-free prob ${(baseProb * 100).toFixed(1)}% @ ${price.decimal.toFixed(2)}`,
          data: { baseProb, priceDecimal: price.decimal, book: price.book },
        },
        ...(bookFilterFallback
          ? [
              {
                source: "adapter" as const,
                id: "book-filter",
                verdict: "NEUTRAL" as const,
                weight: 0,
                message: `Best price from ${price.book} — not in your book list; phantom edge possible`,
                data: { userBooks: ctx.userBooks, offerBook: price.book },
              },
            ]
          : []),
        ...outputs.map(outputToEntry),
        {
          source: "math",
          id: "combined",
          verdict: combined.overallSignal > 0 ? "SUPPORT" : combined.overallSignal < 0 ? "AGAINST" : "NEUTRAL",
          weight: 1,
          message: `Fair prob ${(combined.fairProb * 100).toFixed(1)}% · edge ${(edge * 100).toFixed(2)}% · confidence ${(combined.confidence * 100).toFixed(0)}% · ${bonded ? "bonded ✓" : "not bonded"}`,
          data: {
            perLegSignal: combined.perLegSignal,
            overallSignal: combined.overallSignal,
            fairProb: combined.fairProb,
            edgePct: edge,
            confidence: combined.confidence,
            bonded,
            positiveLegsCount: combined.meta.positiveLegsCount,
            negativeStrong: combined.meta.negativeStrong,
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

  candidates.sort((a, b) => b.edgePct * b.confidence - a.edgePct * a.confidence);

  const comboPolicy = ctx.strategy.comboPolicy ?? DEFAULT_COMBO_POLICY;
  const valueResult = enumerateCombos(candidates, comboPolicy, ctx.generatedAt);
  const anchorResult = enumerateAnchorCombos(
    candidates,
    comboPolicy.anchorMode,
    ctx.generatedAt,
  );
  const combos = [...valueResult.combos, ...anchorResult.combos];
  diagnostics.combos = valueResult.diagnostics;
  diagnostics.anchorCombos = anchorResult.diagnostics;

  if (typeof console !== "undefined" && console.debug) {
    const rulesActive = activeRules.length;
    const rulesFiredCount = Object.keys(diagnostics.rulesFired).length;
    console.debug(
      `[pipeline] match=${ctx.match.id} · ${diagnostics.selectionsEnumerated} selections · ${rulesFiredCount}/${rulesActive} rules fired · verdicts=${JSON.stringify(diagnostics.verdictBreakdown)} · skipped(noPrice=${diagnostics.selectionsSkipped.noPrice}, noBaseProb=${diagnostics.selectionsSkipped.noBaseProb}) · data missing: form(h=${diagnostics.dataMissing.homeForm},a=${diagnostics.dataMissing.awayForm}) xG(h=${diagnostics.dataMissing.homeXG},a=${diagnostics.dataMissing.awayXG}) h2h=${diagnostics.dataMissing.h2hMeetings} splits=${diagnostics.dataMissing.splitsMissing.length}/${strategy.enabledMarkets.length}`,
    );
  }

  return { candidates, combos, diagnostics };
};
