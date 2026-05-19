import { PlayId } from "@/domain/ids";
import { selectionKey, type Selection } from "@/domain/market";
import type { ComboLeg, ComboPlay, ComboType, PlayCandidate } from "@/domain/play";
import type { AnchorComboPolicy, ComboPolicy } from "@/domain/strategy";
import { clamp, edgePct } from "./ev";

// ρ Pearson approximation between binary events "selection occurs"
// Positive: co-occur more than independent; Negative: mutually exclusive pressure.
// Keys are line-agnostic (marketKey:side), since most correlations don't depend
// on the exact OU/AH line — they reflect the directional relationship.
const CORRELATION: Record<string, number> = {
  // ── ML × OU
  "ML_1X2:home|OU_GOALS:under": 0.10,
  "ML_1X2:away|OU_GOALS:under": 0.10,
  "ML_1X2:draw|OU_GOALS:under": 0.30,
  "ML_1X2:home|OU_GOALS:over": 0.15,
  "ML_1X2:away|OU_GOALS:over": 0.15,
  "ML_1X2:draw|OU_GOALS:over": -0.20,

  // ── DNB × OU
  "DNB:home|OU_GOALS:under": 0.20,
  "DNB:away|OU_GOALS:under": 0.20,
  "DNB:home|OU_GOALS:over": 0.18,
  "DNB:away|OU_GOALS:over": 0.18,

  // ── ML × DNB (large overlap — DNB:home wins iff ML:home or draw-push)
  "DNB:home|ML_1X2:home": 0.80,
  "DNB:away|ML_1X2:away": 0.80,
  "DNB:home|ML_1X2:away": -0.65,
  "DNB:away|ML_1X2:home": -0.65,

  // ── ML × DC (DC:1X ⊃ ML:home ∨ ML:draw)
  "DC:1X|ML_1X2:home": 0.70,
  "DC:1X|ML_1X2:draw": 0.55,
  "DC:1X|ML_1X2:away": -0.85,
  "DC:X2|ML_1X2:away": 0.70,
  "DC:X2|ML_1X2:draw": 0.55,
  "DC:X2|ML_1X2:home": -0.85,
  "DC:12|ML_1X2:home": 0.60,
  "DC:12|ML_1X2:away": 0.60,
  "DC:12|ML_1X2:draw": -0.85,

  // ── DC × DNB
  "DC:1X|DNB:home": 0.70,
  "DC:X2|DNB:away": 0.70,
  "DC:12|DNB:home": 0.55,
  "DC:12|DNB:away": 0.55,

  // ── DC × OU
  "DC:1X|OU_GOALS:under": 0.18,
  "DC:X2|OU_GOALS:under": 0.18,
  "DC:12|OU_GOALS:over": 0.20,
  "DC:12|OU_GOALS:under": -0.15,

  // ── ML × AH (home side mirrors)
  "AH:home|ML_1X2:home": 0.60,
  "AH:away|ML_1X2:away": 0.60,
  "AH:home|ML_1X2:away": -0.55,
  "AH:away|ML_1X2:home": -0.55,
  "AH:home|ML_1X2:draw": -0.10,
  "AH:away|ML_1X2:draw": -0.10,

  // ── DNB × AH
  "AH:home|DNB:home": 0.65,
  "AH:away|DNB:away": 0.65,
  "AH:home|DNB:away": -0.55,
  "AH:away|DNB:home": -0.55,

  // ── DC × AH
  "AH:home|DC:1X": 0.50,
  "AH:away|DC:X2": 0.50,
  "AH:home|DC:12": 0.10,
  "AH:away|DC:12": 0.10,

  // ── AH × OU (mild — winning side often produces more goals)
  "AH:home|OU_GOALS:over": 0.12,
  "AH:away|OU_GOALS:over": 0.12,
  "AH:home|OU_GOALS:under": -0.08,
  "AH:away|OU_GOALS:under": -0.08,

  // ── BTTS × OU
  "BTTS:yes|OU_GOALS:over": 0.40,
  "BTTS:no|OU_GOALS:under": 0.45,
  "BTTS:yes|OU_GOALS:under": -0.35,
  "BTTS:no|OU_GOALS:over": -0.30,

  // ── BTTS × ML
  "BTTS:no|ML_1X2:home": 0.05,
  "BTTS:no|ML_1X2:away": 0.05,
  "BTTS:no|ML_1X2:draw": 0.15,
  "BTTS:yes|ML_1X2:draw": 0.20,

  // ── BTTS × DC
  "DC:12|BTTS:yes": 0.25,
  "DC:1X|BTTS:no": 0.20,
  "DC:X2|BTTS:no": 0.20,

  // ── BTTS × AH
  "AH:home|BTTS:yes": 0.10,
  "AH:away|BTTS:yes": 0.10,

  // ── BTTS × DNB
  "DNB:home|BTTS:yes": 0.12,
  "DNB:away|BTTS:yes": 0.12,

  // ── TTG × BTTS
  "BTTS:yes|TTG_AWAY:over": 0.35,
  "BTTS:yes|TTG_HOME:over": 0.35,
  "BTTS:no|TTG_AWAY:under": 0.35,
  "BTTS:no|TTG_HOME:under": 0.35,

  // ── TTG × OU
  "OU_GOALS:over|TTG_HOME:over": 0.45,
  "OU_GOALS:over|TTG_AWAY:over": 0.45,
  "OU_GOALS:under|TTG_HOME:under": 0.45,
  "OU_GOALS:under|TTG_AWAY:under": 0.45,

  // ── TTG × ML
  "ML_1X2:home|TTG_HOME:over": 0.35,
  "ML_1X2:away|TTG_AWAY:over": 0.35,
  "ML_1X2:away|TTG_HOME:under": 0.25,
  "ML_1X2:home|TTG_AWAY:under": 0.25,

  // ── TTG × DC
  "DC:1X|TTG_HOME:over": 0.28,
  "DC:X2|TTG_AWAY:over": 0.28,

  // ── BTTS halves × BTTS full
  "BTTS:yes|BTTS_1H:yes": 0.55,
  "BTTS:yes|BTTS_2H:yes": 0.55,
  "BTTS:no|BTTS_1H:no": 0.45,
  "BTTS:no|BTTS_2H:no": 0.45,

  // ── BTTS_1H × BTTS_2H
  "BTTS_1H:yes|BTTS_2H:yes": 0.30,
  "BTTS_1H:no|BTTS_2H:no": 0.20,

  // ── BTTS_1H × OU
  "BTTS_1H:yes|OU_GOALS:over": 0.30,
  "BTTS_2H:yes|OU_GOALS:over": 0.30,

  // ── CORNERS × OU (high tempo → corners and goals both up)
  "CORNERS_TOTAL:over|OU_GOALS:over": 0.20,
  "CORNERS_TOTAL:under|OU_GOALS:under": 0.18,

  // ── CORNERS × ML (favourite chases → more corners)
  "CORNERS_TOTAL:over|ML_1X2:home": 0.10,
  "CORNERS_TOTAL:over|ML_1X2:away": 0.10,
};

const corrSelectionKey = (s: Selection): string => `${s.marketKey}:${s.side}`;

const corrKey = (a: PlayCandidate, b: PlayCandidate): string => {
  const ka = corrSelectionKey(a.selection);
  const kb = corrSelectionKey(b.selection);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
};

const lookupCorr = (key: string): number => CORRELATION[key] ?? 0;
const hasCorr = (key: string): boolean => key in CORRELATION;

const jointProb = (pA: number, pB: number, rho: number): number => {
  const indep = pA * pB;
  const adjustment = rho * Math.sqrt(pA * (1 - pA) * pB * (1 - pB));
  return clamp(indep + adjustment, 0.001, 0.999);
};

const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `combo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const dominantLegOrigin = (play: PlayCandidate): string | null => {
  for (const e of play.trace) {
    if (e.source === "rule" && e.id === "sharp-square-detector") {
      return `sharp:${String(e.data?.pattern ?? "unknown")}`;
    }
  }
  return null;
};

const buildLeg = (play: PlayCandidate): ComboLeg => ({
  selection: play.selection,
  fairProb: play.fairProb,
  priceDecimal: play.price.decimal,
  baseSelectionId: play.id,
});

const computeCombo = (
  a: PlayCandidate,
  b: PlayCandidate,
  rho: number,
  generatedAt: string,
  comboType: ComboType,
  extraTrace?: string,
): ComboPlay => {
  const combinedFairProb = jointProb(a.fairProb, b.fairProb, rho);
  const combinedDecimal = a.price.decimal * b.price.decimal;
  const edge = edgePct(combinedFairProb, combinedDecimal);
  const confidence = Math.min(a.confidence, b.confidence) * (1 - Math.abs(rho) * 0.2);
  const verdict: ComboPlay["verdict"] =
    edge >= 0.08 ? "STRONG" : edge >= 0.04 ? "PLAY" : "LEAN";
  const key = corrKey(a, b);
  const labelType = comboType === "ANCHOR" ? "Anchor" : "Combo";
  return {
    id: PlayId(uid()),
    matchId: a.matchId,
    legs: [buildLeg(a), buildLeg(b)],
    combinedDecimal,
    combinedFairProb,
    edgePct: edge,
    confidence,
    verdict,
    correlationKey: key,
    rho,
    comboType,
    trace: [
      {
        source: "math",
        id: "combo",
        verdict: "SUPPORT",
        weight: 1,
        message: `${labelType} ${selectionKey(a.selection)} + ${selectionKey(b.selection)} · ρ=${rho.toFixed(2)} · combined ${combinedDecimal.toFixed(2)} @ ${(combinedFairProb * 100).toFixed(1)}% fair · edge ${(edge * 100).toFixed(2)}%${extraTrace ? ` · ${extraTrace}` : ""}`,
        data: { rho, combinedDecimal, combinedFairProb, edgePct: edge, key, comboType },
      },
    ],
    generatedAt,
  };
};

export interface ComboDiagnostics {
  enabled: boolean;
  eligibleCandidates: number;
  pairsConsidered: number;
  rejectedSameMarket: number;
  rejectedSameOrigin: number;
  /** Pairs without a CORRELATION table entry — treated as independent (ρ=0)
   * rather than discarded, so combos can still emerge. Tracked for visibility
   * so users know which pairs need an entry for sharper edge estimates. */
  treatedAsIndependent: number;
  rejectedBelowMinDecimal: number;
  rejectedBelowMinEdge: number;
  rejectedBelowMinFairProb: number;
}

export interface AnchorDiagnostics {
  enabled: boolean;
  eligibleBases: number;
  eligibleAnchors: number;
  pairsConsidered: number;
  rejectedSameMarket: number;
  rejectedSameOrigin: number;
  rejectedBelowMinRho: number;
  rejectedOutsideTargetRange: number;
}

export interface ComboEnumResult {
  combos: ComboPlay[];
  diagnostics: ComboDiagnostics;
}

export interface AnchorEnumResult {
  combos: ComboPlay[];
  diagnostics: AnchorDiagnostics;
}

const emptyComboDiag = (enabled: boolean): ComboDiagnostics => ({
  enabled,
  eligibleCandidates: 0,
  pairsConsidered: 0,
  rejectedSameMarket: 0,
  rejectedSameOrigin: 0,
  treatedAsIndependent: 0,
  rejectedBelowMinDecimal: 0,
  rejectedBelowMinEdge: 0,
  rejectedBelowMinFairProb: 0,
});

const emptyAnchorDiag = (enabled: boolean): AnchorDiagnostics => ({
  enabled,
  eligibleBases: 0,
  eligibleAnchors: 0,
  pairsConsidered: 0,
  rejectedSameMarket: 0,
  rejectedSameOrigin: 0,
  rejectedBelowMinRho: 0,
  rejectedOutsideTargetRange: 0,
});

export const enumerateCombos = (
  candidates: PlayCandidate[],
  policy: ComboPolicy,
  generatedAt: string,
): ComboEnumResult => {
  const diagnostics = emptyComboDiag(policy.enabled);
  if (!policy.enabled || candidates.length < 2) return { combos: [], diagnostics };

  const eligible = candidates.filter(
    (c) => c.verdict === "LEAN" || c.verdict === "PLAY" || c.verdict === "STRONG",
  );
  diagnostics.eligibleCandidates = eligible.length;

  const combos: ComboPlay[] = [];

  for (let i = 0; i < eligible.length - 1; i++) {
    for (let j = i + 1; j < eligible.length; j++) {
      const a = eligible[i];
      const b = eligible[j];
      diagnostics.pairsConsidered++;

      if (a.selection.marketKey === b.selection.marketKey) {
        diagnostics.rejectedSameMarket++;
        continue;
      }

      const originA = dominantLegOrigin(a);
      const originB = dominantLegOrigin(b);
      if (originA !== null && originA === originB) {
        diagnostics.rejectedSameOrigin++;
        continue;
      }

      const key = corrKey(a, b);
      const rho = lookupCorr(key);
      if (!hasCorr(key)) diagnostics.treatedAsIndependent++;

      const combo = computeCombo(a, b, rho, generatedAt, "VALUE");

      if (combo.combinedDecimal < policy.minCombinedDecimal) {
        diagnostics.rejectedBelowMinDecimal++;
        continue;
      }
      if (combo.edgePct < policy.minCombinedEdge) {
        diagnostics.rejectedBelowMinEdge++;
        continue;
      }
      if (combo.combinedFairProb < policy.minCombinedFairProb) {
        diagnostics.rejectedBelowMinFairProb++;
        continue;
      }

      combos.push(combo);
    }
  }

  combos.sort((a, b) => b.edgePct * b.confidence - a.edgePct * a.confidence);
  return { combos, diagnostics };
};

/**
 * Anchor combos: dress up low-decimal high-confidence picks by pairing with a
 * correlated leg of solid confidence to reach the sweet-spot 1.60-2.20 range.
 * Example: BTTS Yes @ 1.49 (high conf) + Over 2.5 (solid conf, ρ=0.40) → 1.78.
 */
export const enumerateAnchorCombos = (
  candidates: PlayCandidate[],
  anchorPolicy: AnchorComboPolicy,
  generatedAt: string,
): AnchorEnumResult => {
  const diagnostics = emptyAnchorDiag(anchorPolicy.enabled);
  if (!anchorPolicy.enabled || candidates.length < 2) return { combos: [], diagnostics };

  const eligibleBases = candidates.filter(
    (c) =>
      (c.verdict === "PLAY" || c.verdict === "STRONG") &&
      c.price.decimal < anchorPolicy.maxBaseDecimal &&
      c.confidence >= anchorPolicy.minBaseConfidence,
  );

  const eligibleAnchors = candidates.filter(
    (c) =>
      (c.verdict === "LEAN" || c.verdict === "PLAY" || c.verdict === "STRONG") &&
      c.confidence >= anchorPolicy.minAnchorConfidence,
  );

  diagnostics.eligibleBases = eligibleBases.length;
  diagnostics.eligibleAnchors = eligibleAnchors.length;

  const combos: ComboPlay[] = [];
  const seenPairs = new Set<string>();

  for (const base of eligibleBases) {
    for (const anchor of eligibleAnchors) {
      if (base.id === anchor.id) continue;
      diagnostics.pairsConsidered++;
      if (base.selection.marketKey === anchor.selection.marketKey) {
        diagnostics.rejectedSameMarket++;
        continue;
      }

      const originA = dominantLegOrigin(base);
      const originB = dominantLegOrigin(anchor);
      if (originA !== null && originA === originB) {
        diagnostics.rejectedSameOrigin++;
        continue;
      }

      const key = corrKey(base, anchor);
      if (seenPairs.has(key)) continue;
      const rho = lookupCorr(key);
      if (rho < anchorPolicy.minRho) {
        diagnostics.rejectedBelowMinRho++;
        continue;
      }

      const combo = computeCombo(
        base,
        anchor,
        rho,
        generatedAt,
        "ANCHOR",
        `base ${base.price.decimal.toFixed(2)} → boosted ${(base.price.decimal * anchor.price.decimal).toFixed(2)}`,
      );

      if (
        combo.combinedDecimal < anchorPolicy.targetMinDecimal ||
        combo.combinedDecimal > anchorPolicy.targetMaxDecimal
      ) {
        diagnostics.rejectedOutsideTargetRange++;
        continue;
      }

      seenPairs.add(key);
      combos.push(combo);
    }
  }

  combos.sort((a, b) => b.edgePct * b.confidence - a.edgePct * a.confidence);
  return { combos, diagnostics };
};
