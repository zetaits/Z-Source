import { PlayId } from "@/domain/ids";
import { selectionKey } from "@/domain/market";
import type { ComboLeg, ComboPlay, PlayCandidate } from "@/domain/play";
import type { ComboPolicy } from "@/domain/strategy";
import { clamp, edgePct } from "./ev";

// ρ Pearson approximation between binary events "selection occurs"
// Positive: co-occur more than independent; Negative: mutually exclusive pressure
const CORRELATION: Record<string, number> = {
  "ML_1X2:home|OU_GOALS:under": 0.10,
  "ML_1X2:away|OU_GOALS:under": 0.10,
  "ML_1X2:draw|OU_GOALS:under": 0.30,
  "DNB:home|OU_GOALS:under": 0.20,
  "DNB:away|OU_GOALS:under": 0.20,
  "ML_1X2:home|OU_GOALS:over": 0.15,
  "ML_1X2:draw|OU_GOALS:over": -0.20,
  "BTTS:yes|OU_GOALS:over": 0.40,
  "BTTS:no|OU_GOALS:under": 0.45,
  "ML_1X2:home|BTTS:no": 0.05,
  "ML_1X2:away|BTTS:no": 0.05,
  "ML_1X2:draw|BTTS:no": 0.15,
};

const corrKey = (a: PlayCandidate, b: PlayCandidate): string => {
  const ka = selectionKey(a.selection);
  const kb = selectionKey(b.selection);
  // Normalize: always smaller lex key first so lookup is order-independent
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
};

const lookupCorr = (key: string): number => CORRELATION[key] ?? 0;

// Joint probability with linear correlation correction (valid for |ρ| ≤ 0.5)
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

export const enumerateCombos = (
  candidates: PlayCandidate[],
  policy: ComboPolicy,
  generatedAt: string,
): ComboPlay[] => {
  if (!policy.enabled || candidates.length < 2) return [];

  // Only actionable candidates qualify as combo legs
  const eligible = candidates.filter(
    (c) => c.verdict === "LEAN" || c.verdict === "PLAY" || c.verdict === "STRONG",
  );

  const combos: ComboPlay[] = [];

  for (let i = 0; i < eligible.length - 1; i++) {
    for (let j = i + 1; j < eligible.length; j++) {
      const a = eligible[i];
      const b = eligible[j];

      // Must be different markets
      if (a.selection.marketKey === b.selection.marketKey) continue;

      // Discard if both legs come from the same sharp pattern (double exposure)
      const originA = dominantLegOrigin(a);
      const originB = dominantLegOrigin(b);
      if (originA !== null && originA === originB) continue;

      const key = corrKey(a, b);
      const rho = lookupCorr(key);

      const combinedFairProb = jointProb(a.fairProb, b.fairProb, rho);
      const combinedDecimal = a.price.decimal * b.price.decimal;
      const edge = edgePct(combinedFairProb, combinedDecimal);
      const confidence = Math.min(a.confidence, b.confidence) * (1 - Math.abs(rho) * 0.2);

      if (
        combinedDecimal < policy.minCombinedDecimal ||
        edge < policy.minCombinedEdge ||
        combinedFairProb < policy.minCombinedFairProb
      )
        continue;

      const verdict = edge >= 0.08 ? "STRONG" : edge >= 0.04 ? "PLAY" : "LEAN";

      const legA: ComboLeg = {
        selection: a.selection,
        fairProb: a.fairProb,
        priceDecimal: a.price.decimal,
        baseSelectionId: a.id,
      };
      const legB: ComboLeg = {
        selection: b.selection,
        fairProb: b.fairProb,
        priceDecimal: b.price.decimal,
        baseSelectionId: b.id,
      };

      combos.push({
        id: PlayId(uid()),
        matchId: a.matchId,
        legs: [legA, legB],
        combinedDecimal,
        combinedFairProb,
        edgePct: edge,
        confidence,
        verdict,
        correlationKey: key,
        rho,
        trace: [
          {
            source: "math",
            id: "combo",
            verdict: "SUPPORT",
            weight: 1,
            message: `Combo ${selectionKey(a.selection)} + ${selectionKey(b.selection)} · ρ=${rho.toFixed(2)} · combined ${(combinedDecimal).toFixed(2)} @ ${(combinedFairProb * 100).toFixed(1)}% fair · edge ${(edge * 100).toFixed(2)}%`,
            data: { rho, combinedDecimal, combinedFairProb, edgePct: edge, key },
          },
        ],
        generatedAt,
      });
    }
  }

  combos.sort((a, b) => b.edgePct * b.confidence - a.edgePct * a.confidence);
  return combos;
};
