import { PlayId } from "@/domain/ids";
import { selectionKey } from "@/domain/market";
import type { ComboLeg, ComboPlay, ComboType, PlayCandidate } from "@/domain/play";
import type { AnchorComboPolicy, ComboPolicy } from "@/domain/strategy";
import { clamp, edgePct } from "./ev";

// ρ Pearson approximation between binary events "selection occurs"
// Positive: co-occur more than independent; Negative: mutually exclusive pressure
const CORRELATION: Record<string, number> = {
  // OU × ML / DNB
  "ML_1X2:home|OU_GOALS:under": 0.10,
  "ML_1X2:away|OU_GOALS:under": 0.10,
  "ML_1X2:draw|OU_GOALS:under": 0.30,
  "DNB:home|OU_GOALS:under": 0.20,
  "DNB:away|OU_GOALS:under": 0.20,
  "ML_1X2:home|OU_GOALS:over": 0.15,
  "ML_1X2:draw|OU_GOALS:over": -0.20,
  // BTTS × OU
  "BTTS:yes|OU_GOALS:over": 0.40,
  "BTTS:no|OU_GOALS:under": 0.45,
  // BTTS × ML
  "ML_1X2:home|BTTS:no": 0.05,
  "ML_1X2:away|BTTS:no": 0.05,
  "ML_1X2:draw|BTTS:no": 0.15,
  // Double Chance × OU
  "DC:1X|OU_GOALS:under": 0.18,
  "DC:X2|OU_GOALS:under": 0.18,
  "DC:12|OU_GOALS:over": 0.20,
  // Double Chance × BTTS
  "DC:12|BTTS:yes": 0.25,
  "DC:1X|BTTS:no": 0.20,
  "DC:X2|BTTS:no": 0.20,
  // Team Total Goals × BTTS (if team scores, BTTS=yes more likely)
  "BTTS:yes|TTG_AWAY:over": 0.35,
  "BTTS:yes|TTG_HOME:over": 0.35,
  "BTTS:no|TTG_AWAY:under": 0.35,
  "BTTS:no|TTG_HOME:under": 0.35,
  // Team Total Goals × OU
  "OU_GOALS:over|TTG_HOME:over": 0.45,
  "OU_GOALS:over|TTG_AWAY:over": 0.45,
  "OU_GOALS:under|TTG_HOME:under": 0.45,
  "OU_GOALS:under|TTG_AWAY:under": 0.45,
  // Team Total Goals × ML (team that wins usually scores more)
  "ML_1X2:home|TTG_HOME:over": 0.35,
  "ML_1X2:away|TTG_AWAY:over": 0.35,
  // BTTS halves × BTTS full match
  "BTTS:yes|BTTS_1H:yes": 0.55,
  "BTTS:yes|BTTS_2H:yes": 0.55,
};

const corrKey = (a: PlayCandidate, b: PlayCandidate): string => {
  const ka = selectionKey(a.selection);
  const kb = selectionKey(b.selection);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
};

const lookupCorr = (key: string): number => CORRELATION[key] ?? 0;

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

export const enumerateCombos = (
  candidates: PlayCandidate[],
  policy: ComboPolicy,
  generatedAt: string,
): ComboPlay[] => {
  if (!policy.enabled || candidates.length < 2) return [];

  const eligible = candidates.filter(
    (c) => c.verdict === "LEAN" || c.verdict === "PLAY" || c.verdict === "STRONG",
  );

  const combos: ComboPlay[] = [];

  for (let i = 0; i < eligible.length - 1; i++) {
    for (let j = i + 1; j < eligible.length; j++) {
      const a = eligible[i];
      const b = eligible[j];

      if (a.selection.marketKey === b.selection.marketKey) continue;

      const originA = dominantLegOrigin(a);
      const originB = dominantLegOrigin(b);
      if (originA !== null && originA === originB) continue;

      const key = corrKey(a, b);
      const rho = lookupCorr(key);

      const combo = computeCombo(a, b, rho, generatedAt, "VALUE");

      if (
        combo.combinedDecimal < policy.minCombinedDecimal ||
        combo.edgePct < policy.minCombinedEdge ||
        combo.combinedFairProb < policy.minCombinedFairProb
      )
        continue;

      combos.push(combo);
    }
  }

  combos.sort((a, b) => b.edgePct * b.confidence - a.edgePct * a.confidence);
  return combos;
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
): ComboPlay[] => {
  if (!anchorPolicy.enabled || candidates.length < 2) return [];

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

  const combos: ComboPlay[] = [];
  const seenPairs = new Set<string>();

  for (const base of eligibleBases) {
    for (const anchor of eligibleAnchors) {
      if (base.id === anchor.id) continue;
      if (base.selection.marketKey === anchor.selection.marketKey) continue;

      const originA = dominantLegOrigin(base);
      const originB = dominantLegOrigin(anchor);
      if (originA !== null && originA === originB) continue;

      const key = corrKey(base, anchor);
      if (seenPairs.has(key)) continue;
      const rho = lookupCorr(key);
      if (rho < anchorPolicy.minRho) continue;

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
      )
        continue;

      seenPairs.add(key);
      combos.push(combo);
    }
  }

  combos.sort((a, b) => b.edgePct * b.confidence - a.edgePct * a.confidence);
  return combos;
};
