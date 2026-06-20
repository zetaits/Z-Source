/**
 * Numeric primitives for the strikeout count distribution:
 *  - log5 per-PA strikeout probability (Bill James odds-ratio, bounded in [0,1]);
 *  - exact Poisson-Binomial pmf via DP (O(n·k));
 *  - a Poisson batters-faced (BF) distribution truncated to a support window;
 *  - mixing per-BF strikeout pmfs over the BF distribution.
 *
 * Pure and deterministic — no I/O, no Date, no randomness. Style mirrors
 * `@/engine/synthetic/poisson` (guarded pmf, renormalised truncation, DP loops).
 */
import { clamp } from "@/engine/ev";
import { BF_PMF_CEIL, BF_PMF_FLOOR, P_EPS } from "./constants";

/**
 * Per-PA strikeout probability via log5 / odds-ratio:
 *   p_K = (P·B/L) / ( P·B/L + (1-P)(1-B)/(1-L) )
 * where P = pitcher K rate, B = batter K rate, L = league K rate. Unlike the raw
 * P·B/L estimator this is always bounded in [0,1]. Inputs are clamped off the
 * 0/1 boundary first so the complements stay finite.
 */
export const log5K = (P: number, B: number, L: number): number => {
  const pc = clamp(P, P_EPS, 1 - P_EPS);
  const bc = clamp(B, P_EPS, 1 - P_EPS);
  const lc = clamp(L, P_EPS, 1 - P_EPS);
  const num = (pc * bc) / lc;
  const den = num + ((1 - pc) * (1 - bc)) / (1 - lc);
  return den <= 0 ? 0 : clamp(num / den, 0, 1);
};

/**
 * Exact pmf of a Poisson-Binomial: the number of successes among independent
 * Bernoulli trials with (possibly distinct) probabilities `probs`.
 *
 * DP recurrence: dp[k] = P(exactly k successes so far). Seed dp=[1]; folding in
 * a trial p gives dp'[k] = dp[k]·(1-p) + dp[k-1]·p. Result length = probs.length+1.
 * O(n·k) time / O(k) extra space. For probs=[] returns [1] (zero successes a.s.).
 * The result sums to 1 by construction (each fold preserves total mass).
 */
export const poissonBinomialPmf = (probs: number[]): number[] => {
  let dp = [1];
  for (const raw of probs) {
    const p = clamp(raw, 0, 1);
    const next = new Array(dp.length + 1).fill(0);
    for (let k = 0; k < dp.length; k++) {
      next[k] += dp[k] * (1 - p);
      next[k + 1] += dp[k] * p;
    }
    dp = next;
  }
  return dp;
};

/**
 * Poisson pmf of batters faced over [BF_PMF_FLOOR, BF_PMF_CEIL], renormalised to
 * sum to 1. Returns a dense map keyed by BF count (only the support window is
 * present). λ ≤ 0 degenerates to all mass on the floor.
 */
export const bfPoissonDistribution = (lambda: number): Map<number, number> => {
  const out = new Map<number, number>();
  if (lambda <= 0) {
    out.set(BF_PMF_FLOOR, 1);
    return out;
  }
  // Unnormalised Poisson weight exp(-λ) λ^k / k!, built incrementally across the
  // window to avoid factorial overflow: w_k = w_{k-1} · λ / k starting from k=1.
  // We only need relative weights since we renormalise, so the leading exp(-λ)
  // constant cancels and is omitted.
  let weight = 1; // proportional to λ^0 / 0!
  for (let k = 1; k <= BF_PMF_FLOOR; k++) weight *= lambda / k;
  let total = 0;
  for (let bf = BF_PMF_FLOOR; bf <= BF_PMF_CEIL; bf++) {
    out.set(bf, weight);
    total += weight;
    weight *= lambda / (bf + 1);
  }
  if (total <= 0) {
    out.clear();
    out.set(BF_PMF_FLOOR, 1);
    return out;
  }
  for (const [bf, w] of out) out.set(bf, w / total);
  return out;
};

/**
 * Mixture strikeout pmf: for each BF in the support, take the first `bf` per-PA
 * probabilities, compute that conditional K pmf via Poisson-Binomial DP, and
 * mix by the BF distribution. `perPaProbs` must cover the largest BF in support
 * (length ≥ max key of `bfDist`); the caller builds it up to BF_PMF_CEIL.
 *
 * Result length = BF_PMF_CEIL + 1 (index = K count); sums to 1 when `bfDist`
 * sums to 1 (each conditional pmf sums to 1 and the mix is a convex combination).
 */
export const mixStrikeoutPmf = (
  perPaProbs: number[],
  bfDist: Map<number, number>,
): number[] => {
  const mixed = new Array(BF_PMF_CEIL + 1).fill(0);
  for (const [bf, w] of bfDist) {
    if (w <= 0) continue;
    const n = Math.min(bf, perPaProbs.length);
    const cond = poissonBinomialPmf(perPaProbs.slice(0, n));
    for (let k = 0; k < cond.length && k < mixed.length; k++) {
      mixed[k] += w * cond[k];
    }
  }
  return mixed;
};

/** Expected value Σ k·pmf[k] of a count pmf. */
export const pmfMean = (pmf: number[]): number => {
  let m = 0;
  for (let k = 0; k < pmf.length; k++) m += k * pmf[k];
  return m;
};

/**
 * Tail probability P(K > line) for a count pmf. Strict-greater so a .5 line
 * (e.g. 5.5 -> P(K≥6)) works directly and integer lines exclude the push.
 */
export const tailOver = (pmf: number[], line: number): number => {
  let p = 0;
  for (let k = 0; k < pmf.length; k++) {
    if (k > line) p += pmf[k];
  }
  return p;
};
