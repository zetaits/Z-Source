import type { MarketKey, Selection } from "@/domain/market";
import type { PlayCandidate } from "@/domain/play";
import type { Splits } from "@/domain/splits";
import type { ReasoningVerdict } from "@/domain/trace";

/** Rule id emitted by the engine's sharp-vs-square detector. */
const SHARP_RULE_ID = "sharp-square-detector";

/** Patterns the detector can surface. SUPPORT = be on this side (sharp);
 *  AGAINST = fade this side (public/square). FLAT = no pattern fired. */
export type SharpPattern =
  | "REVERSE_LINE_MOVEMENT"
  | "PUBLIC_DOG_TRAP_CONFIRMED"
  | "SHARP_MONEY_DIVERGENCE"
  | "PURE_FADE_PUBLIC"
  | "FLAT";

/**
 * One market's crowd-vs-sharp read, lifted straight from the engine verdict
 * (no parallel re-derivation). `selection` is the side the pattern is about;
 * `verdict` says whether sharps are ON it (SUPPORT) or fading it (AGAINST).
 */
export interface MarketSignal {
  marketKey: MarketKey;
  selection: Selection;
  pattern: SharpPattern;
  verdict: ReasoningVerdict;
  /** Signed strength from the engine: >0 sharp-side, <0 fade-side. */
  strength: number;
  betsPct?: number;
  moneyPct?: number;
  message: string;
}

/** Most lopsided public position across all split markets — the crowd's pick. */
export interface PublicLean {
  marketKey: MarketKey;
  selection: Selection;
  betsPct: number;
  moneyPct?: number;
}

interface SharpData {
  pattern?: unknown;
  betsPct?: unknown;
  moneyPct?: unknown;
  strength?: unknown;
}

const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

/**
 * Harvest the sharp-vs-square verdict the engine already computed for every
 * priced selection (it runs with includePass, so each side is in
 * `allCandidates[].trace`). Returns the strongest signal per market plus the
 * single strongest overall — same brain as the picks, no naive |delta| guess.
 */
export const extractMarketSignals = (
  candidates: PlayCandidate[],
): { byMarket: Map<MarketKey, MarketSignal>; top: MarketSignal | null } => {
  const byMarket = new Map<MarketKey, MarketSignal>();

  for (const c of candidates) {
    const entry = c.trace.find(
      (e) => e.id === SHARP_RULE_ID && e.verdict !== "NEUTRAL",
    );
    if (!entry) continue;
    const data = (entry.data ?? {}) as SharpData;
    const strength = num(data.strength) ?? 0;
    const signal: MarketSignal = {
      marketKey: c.selection.marketKey,
      selection: c.selection,
      pattern: (typeof data.pattern === "string" ? data.pattern : "FLAT") as SharpPattern,
      verdict: entry.verdict,
      strength,
      betsPct: num(data.betsPct),
      moneyPct: num(data.moneyPct),
      message: entry.message,
    };
    const existing = byMarket.get(signal.marketKey);
    if (!existing || Math.abs(signal.strength) > Math.abs(existing.strength)) {
      byMarket.set(signal.marketKey, signal);
    }
  }

  let top: MarketSignal | null = null;
  for (const s of byMarket.values()) {
    if (!top || Math.abs(s.strength) > Math.abs(top.strength)) top = s;
  }
  return { byMarket, top };
};

/**
 * Where the crowd sits by ticket count — used to frame the FLAT headline
 * ("money tracks the public") when no sharp pattern fired.
 */
export const topPublicLean = (
  splits: Partial<Record<MarketKey, Splits>>,
): PublicLean | null => {
  let best: PublicLean | null = null;
  for (const [marketKey, group] of Object.entries(splits) as [MarketKey, Splits][]) {
    for (const row of group.rows) {
      if (typeof row.betsPct !== "number") continue;
      if (!best || row.betsPct > best.betsPct) {
        best = {
          marketKey,
          selection: row.selection,
          betsPct: row.betsPct,
          moneyPct: typeof row.moneyPct === "number" ? row.moneyPct : undefined,
        };
      }
    }
  }
  return best;
};
