/**
 * High-level helpers that turn live `LineSnapshot`s into synthetic alternative
 * lines suitable for display in the OddsBoard / LinesTab.
 *
 * Bases are aggregated using a sharpness-priority strategy: when multiple
 * books quote the same line, the sharpest book is preferred (Sbobet > Bet365
 * for the books reachable via odds-api.io's free tier). Sharp books carry
 * tighter overround and closer-to-true fair probabilities, so their prices
 * anchor the Poisson / Dixon-Coles fit more accurately than a naïve median
 * across retail + sharp. Falls back to median across the most-sharp tier
 * present.
 */
import type { LineSnapshot } from "@/domain/odds";
import type { BookOffer } from "@/domain/odds";
import {
  buildLineLadder,
  synthesizeAsianHandicap,
  synthesizeOverUnder,
  type AHBaseLine,
  type ML1X2BaseLine,
  type OUBaseLine,
  type SyntheticPrice,
} from "./altLines";

export type { SyntheticPrice, SynthesizeOptions } from "./altLines";

// Lower index = sharper book. Reachable via odds-api.io free tier.
const SHARPNESS_RANK = ["sbobet", "bet365"];

const bookSharpness = (book: string): number => {
  const k = book.toLowerCase().trim();
  for (let i = 0; i < SHARPNESS_RANK.length; i++) {
    if (k.startsWith(SHARPNESS_RANK[i])) return i;
  }
  return SHARPNESS_RANK.length;
};

const median = (xs: number[]): number => {
  const sorted = [...xs].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[m - 1] + sorted[m]) / 2;
  return sorted[m];
};

/** Pick decimals from the sharpest tier present in `offers`. */
const preferSharp = (offers: BookOffer[]): number[] => {
  if (offers.length === 0) return [];
  let bestRank = Infinity;
  for (const o of offers) {
    const r = bookSharpness(String(o.book));
    if (r < bestRank) bestRank = r;
  }
  return offers
    .filter((o) => bookSharpness(String(o.book)) === bestRank)
    .map((o) => o.decimal);
};

const aggregateOUBases = (snap: LineSnapshot): OUBaseLine[] => {
  const byLine = new Map<number, { overs: BookOffer[]; unders: BookOffer[] }>();
  for (const o of snap.offers) {
    const line = o.selection.line;
    if (line === undefined) continue;
    const entry = byLine.get(line) ?? { overs: [], unders: [] };
    if (o.selection.side === "over") entry.overs.push(o);
    else if (o.selection.side === "under") entry.unders.push(o);
    byLine.set(line, entry);
  }
  const out: OUBaseLine[] = [];
  for (const [line, { overs, unders }] of byLine) {
    const overDecs = preferSharp(overs);
    const underDecs = preferSharp(unders);
    if (overDecs.length === 0 || underDecs.length === 0) continue;
    out.push({ line, over: median(overDecs), under: median(underDecs) });
  }
  out.sort((a, b) => a.line - b.line);
  return out;
};

const aggregateML1X2Base = (snap: LineSnapshot): ML1X2BaseLine | null => {
  const homes: BookOffer[] = [];
  const draws: BookOffer[] = [];
  const aways: BookOffer[] = [];
  for (const o of snap.offers) {
    if (o.selection.side === "home") homes.push(o);
    else if (o.selection.side === "draw") draws.push(o);
    else if (o.selection.side === "away") aways.push(o);
  }
  const homeDecs = preferSharp(homes);
  const drawDecs = preferSharp(draws);
  const awayDecs = preferSharp(aways);
  if (homeDecs.length === 0 || drawDecs.length === 0 || awayDecs.length === 0)
    return null;
  return {
    home: median(homeDecs),
    draw: median(drawDecs),
    away: median(awayDecs),
  };
};

const aggregateAHBases = (snap: LineSnapshot): AHBaseLine[] => {
  const byLine = new Map<number, { homes: BookOffer[]; aways: BookOffer[] }>();
  for (const o of snap.offers) {
    const line = o.selection.line;
    if (line === undefined) continue;
    const entry = byLine.get(line) ?? { homes: [], aways: [] };
    if (o.selection.side === "home") entry.homes.push(o);
    else if (o.selection.side === "away") entry.aways.push(o);
    byLine.set(line, entry);
  }
  const out: AHBaseLine[] = [];
  for (const [line, { homes, aways }] of byLine) {
    const homeDecs = preferSharp(homes);
    const awayDecs = preferSharp(aways);
    if (homeDecs.length === 0 || awayDecs.length === 0) continue;
    out.push({ line, home: median(homeDecs), away: median(awayDecs) });
  }
  out.sort((a, b) => a.line - b.line);
  return out;
};

export interface ComputeSyntheticOptions {
  /** Quarter-spaced ladder radius around the centre base line. Default 2.0. */
  radius?: number;
  /** Step between ladder points. Default 0.25. */
  step?: number;
  /** Dixon-Coles correlation. Default 0.13. */
  rho?: number;
  /** Override base error percentages. */
  ouBaseError?: number;
  ahBaseError?: number;
  errorAlpha?: number;
}

const DEFAULT_RADIUS = 2.0;
const DEFAULT_STEP = 0.25;

const linesPresentIn = (snap: LineSnapshot): Set<number> => {
  const out = new Set<number>();
  for (const o of snap.offers) {
    if (o.selection.line !== undefined) out.add(o.selection.line);
  }
  return out;
};

/**
 * Generate synthetic O/U lines around the median real base line. Lines that
 * already exist as real offers are skipped (no duplicates).
 */
export const computeSyntheticOU = (
  snap: LineSnapshot | undefined,
  opts: ComputeSyntheticOptions = {},
): SyntheticPrice[] => {
  if (!snap) return [];
  const bases = aggregateOUBases(snap);
  if (bases.length === 0) return [];
  const centre = bases[Math.floor(bases.length / 2)].line;
  const present = linesPresentIn(snap);
  const ladder = buildLineLadder(
    centre,
    opts.radius ?? DEFAULT_RADIUS,
    opts.step ?? DEFAULT_STEP,
  ).filter((l) => !present.has(l));
  if (ladder.length === 0) return [];
  return synthesizeOverUnder(bases, ladder, {
    ouBaseError: opts.ouBaseError,
    errorAlpha: opts.errorAlpha,
  });
};

/**
 * Generate synthetic AH lines. Requires both an O/U snapshot (to pin
 * lambda_total) and an AH snapshot (to pin the home/away split). When a 1X2
 * snapshot is provided, the home/away split fit is jointly constrained — this
 * meaningfully tightens the split when AH bases cluster near the pivot, where
 * AH alone is a weak signal for the home vs away rate split. Lines that
 * already exist as real offers are skipped.
 */
export const computeSyntheticAH = (
  ouSnap: LineSnapshot | undefined,
  ahSnap: LineSnapshot | undefined,
  mlSnap: LineSnapshot | undefined,
  opts: ComputeSyntheticOptions = {},
): SyntheticPrice[] => {
  if (!ouSnap || !ahSnap) return [];
  const ouBases = aggregateOUBases(ouSnap);
  const ahBases = aggregateAHBases(ahSnap);
  if (ouBases.length === 0 || ahBases.length === 0) return [];
  const ml1x2 = mlSnap ? aggregateML1X2Base(mlSnap) ?? undefined : undefined;
  const centre = ahBases[Math.floor(ahBases.length / 2)].line;
  const present = linesPresentIn(ahSnap);
  const ladder = buildLineLadder(
    centre,
    opts.radius ?? DEFAULT_RADIUS,
    opts.step ?? DEFAULT_STEP,
  ).filter((l) => !present.has(l));
  if (ladder.length === 0) return [];
  return synthesizeAsianHandicap(
    ouBases,
    ahBases,
    ladder,
    {
      rho: opts.rho,
      ahBaseError: opts.ahBaseError,
      errorAlpha: opts.errorAlpha,
    },
    ml1x2,
  );
};
