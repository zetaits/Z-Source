/**
 * Public API for synthesising alternative O/U and AH lines from a small set of
 * real-market base lines. Returns synthetic decimal prices plus a per-line
 * confidence band (`±%`) that grows with extrapolation distance from the
 * nearest base line.
 *
 * Use cases (consumers must respect the confidence band):
 *  - OddsBoard / LinesTab display gap-fill (annotate as synthetic).
 *  - MatchupTab market-implied xG when O/U fit is available.
 *  - Hedge / sizing helpers where a real price is missing.
 *
 * NOT for engine edge calculation: synthetic prices are derived from the same
 * fair probability they would be compared against — edge would be zero by
 * construction.
 */
import { buildDixonColesMatrix, ahFairProbs } from "./dixonColes";
import { ouFairProbs } from "./poisson";
import {
  fitLambdaOU,
  fitLambdaSplitJoint,
  fitPowerK,
  type AHBaseLine,
  type ML1X2BaseLine,
  type OUBaseLine,
} from "./optimizer";

export type { AHBaseLine, ML1X2BaseLine, OUBaseLine } from "./optimizer";

export type SyntheticSide = "over" | "under" | "home" | "away";

export interface SyntheticPrice {
  line: number;
  side: SyntheticSide;
  decimal: number;
  /** ±error percentage; grows with distance from nearest base line. */
  confidencePct: number;
}

export interface SynthesizeOptions {
  /** Dixon-Coles low-score correlation. Empirical default 0.13 for football. */
  rho?: number;
  /** Base error percentage at the closest real anchor. */
  ouBaseError?: number;
  ahBaseError?: number;
  /** Per-line-distance error growth (% per 1.0 line unit). */
  errorAlpha?: number;
}

const DEFAULT_RHO = 0.13;
const DEFAULT_OU_BASE_ERROR = 1.0;
const DEFAULT_AH_BASE_ERROR = 2.5;
const DEFAULT_ERROR_ALPHA = 0.8;
const MIN_PROB = 1e-6;

const FOOTBALL_LAMBDA_MIN = 1.4;
const FOOTBALL_LAMBDA_MAX = 5.0;
const FOOTBALL_K_MIN = 1.0;
const FOOTBALL_K_MAX = 1.40;

const round2 = (n: number): number => Math.round(n * 100) / 100;

const confidenceAt = (
  target: number,
  bases: number[],
  baseError: number,
  alpha: number,
): number => {
  if (bases.length === 0) return baseError;
  let dist = Number.POSITIVE_INFINITY;
  for (const b of bases) {
    const d = Math.abs(target - b);
    if (d < dist) dist = d;
  }
  return round2(baseError + alpha * dist);
};

export interface MarketModelFit {
  ou: { lambda: number; k: number };
  ah?: { lamHome: number; lamAway: number; k: number; rho: number };
}

/**
 * Fit a single coherent goal-expectation model from the available real-market
 * bases. Returns `null` when O/U bases are missing (the model is anchored on
 * O/U; AH alone cannot pin down the total).
 */
export const fitMarketModel = (
  ouBases: OUBaseLine[],
  ahBases?: AHBaseLine[],
  rho: number = DEFAULT_RHO,
  ml1x2?: ML1X2BaseLine,
): MarketModelFit | null => {
  if (ouBases.length === 0) return null;
  const kOU = fitPowerK(ouBases.map((b) => ({ a: b.over, b: b.under })));
  const lambda = fitLambdaOU(kOU, ouBases);
  const fit: MarketModelFit = { ou: { lambda, k: kOU } };
  if (ahBases && ahBases.length > 0) {
    const kAH = fitPowerK(ahBases.map((b) => ({ a: b.home, b: b.away })));
    const lamHome = fitLambdaSplitJoint(lambda, kAH, rho, ahBases, ml1x2);
    fit.ah = { lamHome, lamAway: lambda - lamHome, k: kAH, rho };
  }
  return fit;
};

export const synthesizeOverUnder = (
  bases: OUBaseLine[],
  targets: number[],
  opts: SynthesizeOptions = {},
): SyntheticPrice[] => {
  if (bases.length === 0) return [];
  const k = fitPowerK(bases.map((b) => ({ a: b.over, b: b.under })));
  const lambda = fitLambdaOU(k, bases);
  if (
    lambda < FOOTBALL_LAMBDA_MIN ||
    lambda > FOOTBALL_LAMBDA_MAX ||
    k < FOOTBALL_K_MIN ||
    k > FOOTBALL_K_MAX
  ) {
    console.warn(
      "[synthetic OU] implausible fit — skipping synthesis",
      { lambda: +lambda.toFixed(3), k: +k.toFixed(3), bases },
    );
    return [];
  }
  const baseLines = bases.map((b) => b.line);
  const baseErr = opts.ouBaseError ?? DEFAULT_OU_BASE_ERROR;
  const alpha = opts.errorAlpha ?? DEFAULT_ERROR_ALPHA;
  const out: SyntheticPrice[] = [];
  for (const target of targets) {
    const { over, under } = ouFairProbs(lambda, target);
    const conf = confidenceAt(target, baseLines, baseErr, alpha);
    if (over > MIN_PROB) {
      out.push({
        line: target,
        side: "over",
        decimal: round2(1 / Math.pow(over, 1 / k)),
        confidencePct: conf,
      });
    }
    if (under > MIN_PROB) {
      out.push({
        line: target,
        side: "under",
        decimal: round2(1 / Math.pow(under, 1 / k)),
        confidencePct: conf,
      });
    }
  }
  return out;
};

export const synthesizeAsianHandicap = (
  ouBases: OUBaseLine[],
  ahBases: AHBaseLine[],
  targets: number[],
  opts: SynthesizeOptions = {},
  ml1x2?: ML1X2BaseLine,
): SyntheticPrice[] => {
  if (ouBases.length === 0 || ahBases.length === 0) return [];
  const rho = opts.rho ?? DEFAULT_RHO;
  const kOU = fitPowerK(ouBases.map((b) => ({ a: b.over, b: b.under })));
  const lamTotal = fitLambdaOU(kOU, ouBases);
  const kAH = fitPowerK(ahBases.map((b) => ({ a: b.home, b: b.away })));
  if (
    lamTotal < FOOTBALL_LAMBDA_MIN ||
    lamTotal > FOOTBALL_LAMBDA_MAX ||
    kAH < FOOTBALL_K_MIN ||
    kAH > FOOTBALL_K_MAX
  ) {
    console.warn(
      "[synthetic AH] implausible fit — skipping synthesis",
      {
        lamTotal: +lamTotal.toFixed(3),
        kOU: +kOU.toFixed(3),
        kAH: +kAH.toFixed(3),
        ouBases,
        ahBases,
      },
    );
    return [];
  }
  const lamHome = fitLambdaSplitJoint(lamTotal, kAH, rho, ahBases, ml1x2);
  const lamAway = lamTotal - lamHome;
  const mat = buildDixonColesMatrix(lamHome, lamAway, rho);
  const baseLines = ahBases.map((b) => b.line);
  const baseErr = opts.ahBaseError ?? DEFAULT_AH_BASE_ERROR;
  const alpha = opts.errorAlpha ?? DEFAULT_ERROR_ALPHA;
  const out: SyntheticPrice[] = [];
  for (const target of targets) {
    const { home, away } = ahFairProbs(mat, target);
    const conf = confidenceAt(target, baseLines, baseErr, alpha);
    if (home > MIN_PROB) {
      out.push({
        line: target,
        side: "home",
        decimal: round2(1 / Math.pow(home, 1 / kAH)),
        confidencePct: conf,
      });
    }
    if (away > MIN_PROB) {
      out.push({
        line: target,
        side: "away",
        decimal: round2(1 / Math.pow(away, 1 / kAH)),
        confidencePct: conf,
      });
    }
  }
  return out;
};

/**
 * Default fan-out range around a centre line. Builds a quarter-spaced ladder
 * from `centre - radius` to `centre + radius` excluding the centre itself.
 */
export const buildLineLadder = (
  centre: number,
  radius: number,
  step: number = 0.25,
): number[] => {
  const out: number[] = [];
  const lo = centre - radius;
  const hi = centre + radius;
  for (let v = lo; v <= hi + 1e-9; v += step) {
    const r = Math.round(v * 4) / 4;
    if (Math.abs(r - centre) < 1e-9) continue;
    out.push(r);
  }
  return out;
};
