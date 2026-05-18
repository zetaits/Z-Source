/**
 * Multi-line joint fits for the Power method (overround exponent k) and the
 * Poisson / Dixon-Coles goal-expectations (lambda_total, lambda_home).
 *
 * All routines use 1D bisection on a monotonic signed residual sum across the
 * available real-market base lines. Multi-line fits cut residuals dramatically
 * vs single-line: O/U with 3 anchors and AH with 2 anchors are over-determined
 * which stabilises the split between the two team rates.
 */
import { ahFairProbs, ahProbabilitiesRaw, buildDixonColesMatrix } from "./dixonColes";
import { ouFairProbs } from "./poisson";

export interface PricePair {
  a: number;
  b: number;
}

export interface OUBaseLine {
  line: number;
  over: number;
  under: number;
}

export interface AHBaseLine {
  line: number;
  home: number;
  away: number;
}

export interface ML1X2BaseLine {
  home: number;
  draw: number;
  away: number;
}

const K_LO = 1.0;
const K_HI = 2.0;
const K_ITERS = 60;

/**
 * Find the shared overround exponent k where the average implied probabilities
 * sum to 1 across all (a, b) pairs. Monotonic in k for k >= 1.
 */
export const fitPowerK = (pairs: PricePair[]): number => {
  if (pairs.length === 0) return 1.0;
  let lo = K_LO;
  let hi = K_HI;
  for (let i = 0; i < K_ITERS; i++) {
    const mid = (lo + hi) / 2;
    let s = 0;
    for (const { a, b } of pairs) {
      s += Math.pow(1 / a, mid) + Math.pow(1 / b, mid) - 1;
    }
    if (s > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};

/**
 * N-way generalisation of `fitPowerK` for events with arbitrary outcome count
 * (e.g. 1X2 has 3 outcomes). Each event contributes one residual.
 */
export const fitPowerKN = (events: number[][]): number => {
  if (events.length === 0) return 1.0;
  let lo = K_LO;
  let hi = K_HI;
  for (let i = 0; i < K_ITERS; i++) {
    const mid = (lo + hi) / 2;
    let s = 0;
    for (const decs of events) {
      let sum = 0;
      for (const d of decs) sum += Math.pow(1 / d, mid);
      s += sum - 1;
    }
    if (s > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};

const LAMBDA_LO = 0.05;
const LAMBDA_HI = 8;
const LAMBDA_ITERS = 80;

/**
 * Find lambda_total minimising the residual of the de-vigged under probability
 * (`pu^k`) versus the Poisson CDF prediction across all O/U base lines.
 */
export const fitLambdaOU = (k: number, bases: OUBaseLine[]): number => {
  if (bases.length === 0) return 2.5;
  const targets = bases.map((b) => Math.pow(1 / b.under, k));
  let lo = LAMBDA_LO;
  let hi = LAMBDA_HI;
  for (let i = 0; i < LAMBDA_ITERS; i++) {
    const mid = (lo + hi) / 2;
    let s = 0;
    for (let j = 0; j < bases.length; j++) {
      const { under } = ouFairProbs(mid, bases[j].line);
      s += under - targets[j];
    }
    if (s > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};

const SPLIT_ITERS = 50;

/**
 * Given lambda_total, find lambda_home such that the Dixon-Coles AH home
 * probability matches the de-vigged target (`p_h^k`) across all AH base lines.
 */
export const fitLambdaSplitAH = (
  lamTotal: number,
  k: number,
  rho: number,
  bases: AHBaseLine[],
): number => {
  if (bases.length === 0 || lamTotal <= 0.1) return lamTotal / 2;
  const targets = bases.map((b) => Math.pow(1 / b.home, k));
  const eps = Math.min(0.05, lamTotal * 0.05);
  let lo = eps;
  let hi = lamTotal - eps;
  for (let i = 0; i < SPLIT_ITERS; i++) {
    const mid = (lo + hi) / 2;
    const mat = buildDixonColesMatrix(mid, lamTotal - mid, rho);
    let s = 0;
    for (let j = 0; j < bases.length; j++) {
      const { home } = ahFairProbs(mat, bases[j].line);
      s += home - targets[j];
    }
    if (s > 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
};

/**
 * Joint fit of lambda_home using AH bases AND optional 1X2 base. The 1X2 base
 * constrains the home/away split via the marginal home_win/away_win
 * probabilities computed from the Dixon-Coles matrix at line=0 — especially
 * valuable when AH bases cluster near the pivot (weak split signal).
 *
 * AH residual sign: predicted - target on home prob; positive → λ_home too high.
 * 1X2 residuals: home_win (same sign) + away_win (inverted: target - predicted).
 */
export const fitLambdaSplitJoint = (
  lamTotal: number,
  kAH: number,
  rho: number,
  ahBases: AHBaseLine[],
  ml1x2?: ML1X2BaseLine,
): number => {
  if (ahBases.length === 0 && !ml1x2) return lamTotal / 2;
  if (lamTotal <= 0.1) return lamTotal / 2;
  const ahTargets = ahBases.map((b) => Math.pow(1 / b.home, kAH));
  let mlHomeTarget = 0;
  let mlAwayTarget = 0;
  let hasML = false;
  if (ml1x2) {
    const k1x2 = fitPowerKN([[ml1x2.home, ml1x2.draw, ml1x2.away]]);
    mlHomeTarget = Math.pow(1 / ml1x2.home, k1x2);
    mlAwayTarget = Math.pow(1 / ml1x2.away, k1x2);
    hasML = true;
  }
  const eps = Math.min(0.05, lamTotal * 0.05);
  let lo = eps;
  let hi = lamTotal - eps;
  for (let i = 0; i < SPLIT_ITERS; i++) {
    const mid = (lo + hi) / 2;
    const mat = buildDixonColesMatrix(mid, lamTotal - mid, rho);
    let s = 0;
    for (let j = 0; j < ahBases.length; j++) {
      const { home } = ahFairProbs(mat, ahBases[j].line);
      s += home - ahTargets[j];
    }
    if (hasML) {
      const raw = ahProbabilitiesRaw(mat, 0);
      s += raw.home - mlHomeTarget;
      s += mlAwayTarget - raw.away;
    }
    if (s > 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
};
