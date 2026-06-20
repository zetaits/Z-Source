import { describe, expect, it } from "vitest";
import { BF_PMF_CEIL, BF_PMF_FLOOR } from "./constants";
import {
  bfPoissonDistribution,
  log5K,
  mixStrikeoutPmf,
  pmfMean,
  poissonBinomialPmf,
  tailOver,
} from "./poissonBinomial";

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

describe("log5K", () => {
  it("returns the input rate when batter and league rates coincide", () => {
    // B = L collapses log5 to P exactly.
    expect(log5K(0.3, 0.222, 0.222)).toBeCloseTo(0.3, 10);
  });

  it("stays bounded in [0,1] for extreme inputs (unlike raw P·B/L)", () => {
    for (const P of [0.0001, 0.3, 0.6, 0.9999]) {
      for (const B of [0.0001, 0.5, 0.9999]) {
        const p = log5K(P, B, 0.222);
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      }
    }
  });

  it("is monotonic increasing in both pitcher and batter rate", () => {
    expect(log5K(0.4, 0.25, 0.222)).toBeGreaterThan(log5K(0.2, 0.25, 0.222));
    expect(log5K(0.3, 0.35, 0.222)).toBeGreaterThan(log5K(0.3, 0.15, 0.222));
  });
});

describe("poissonBinomialPmf", () => {
  it("returns [1] for an empty trial list", () => {
    expect(poissonBinomialPmf([])).toEqual([1]);
  });

  it("equals the Binomial pmf when all probs are equal", () => {
    const p = 0.25;
    const n = 6;
    const pb = poissonBinomialPmf(new Array(n).fill(p));
    const choose = (a: number, b: number): number => {
      let r = 1;
      for (let i = 0; i < b; i++) r = (r * (a - i)) / (i + 1);
      return r;
    };
    for (let k = 0; k <= n; k++) {
      const binom = choose(n, k) * p ** k * (1 - p) ** (n - k);
      expect(pb[k]).toBeCloseTo(binom, 10);
    }
  });

  it("pmf sums to 1 for heterogeneous probs", () => {
    const pb = poissonBinomialPmf([0.1, 0.4, 0.8, 0.05, 0.6, 0.33]);
    expect(sum(pb)).toBeCloseTo(1, 12);
  });

  it("mean equals Σ p_i", () => {
    const probs = [0.1, 0.4, 0.8, 0.05, 0.6];
    const pb = poissonBinomialPmf(probs);
    expect(pmfMean(pb)).toBeCloseTo(sum(probs), 12);
  });
});

describe("bfPoissonDistribution", () => {
  it("is supported only on [FLOOR, CEIL] and sums to 1", () => {
    const dist = bfPoissonDistribution(23.6);
    let total = 0;
    for (const [bf, w] of dist) {
      expect(bf).toBeGreaterThanOrEqual(BF_PMF_FLOOR);
      expect(bf).toBeLessThanOrEqual(BF_PMF_CEIL);
      expect(w).toBeGreaterThanOrEqual(0);
      total += w;
    }
    expect(total).toBeCloseTo(1, 12);
  });

  it("degenerates to all mass on the floor for λ<=0", () => {
    const dist = bfPoissonDistribution(0);
    expect(dist.get(BF_PMF_FLOOR)).toBe(1);
    expect(dist.size).toBe(1);
  });

  it("shifts its mode higher as λ increases", () => {
    const meanOf = (lam: number): number => {
      let m = 0;
      for (const [bf, w] of bfPoissonDistribution(lam)) m += bf * w;
      return m;
    };
    expect(meanOf(28)).toBeGreaterThan(meanOf(18));
  });
});

describe("mixStrikeoutPmf", () => {
  it("produces a pmf of length CEIL+1 that sums to 1", () => {
    const probs = new Array(BF_PMF_CEIL).fill(0.24);
    const dist = bfPoissonDistribution(23.6);
    const pmf = mixStrikeoutPmf(probs, dist);
    expect(pmf.length).toBe(BF_PMF_CEIL + 1);
    expect(sum(pmf)).toBeCloseTo(1, 10);
  });

  it("mixture mean lies between the min-BF and max-BF conditional means", () => {
    const probs = new Array(BF_PMF_CEIL).fill(0.24);
    const dist = bfPoissonDistribution(23.6);
    const mixMean = pmfMean(mixStrikeoutPmf(probs, dist));
    // Each PA has p=0.24, so conditional mean at bf is 0.24*bf.
    expect(mixMean).toBeGreaterThan(0.24 * BF_PMF_FLOOR);
    expect(mixMean).toBeLessThan(0.24 * BF_PMF_CEIL);
  });
});

describe("tailOver", () => {
  it("P(K > line) on a .5 line is P(K >= ceil)", () => {
    const pmf = [0.1, 0.2, 0.3, 0.25, 0.15];
    // line 2.5 -> K >= 3 -> 0.25 + 0.15
    expect(tailOver(pmf, 2.5)).toBeCloseTo(0.4, 12);
  });

  it("integer line excludes the push (strict greater)", () => {
    const pmf = [0.1, 0.2, 0.3, 0.4];
    // line 2 -> K > 2 -> only k=3
    expect(tailOver(pmf, 2)).toBeCloseTo(0.4, 12);
  });
});
