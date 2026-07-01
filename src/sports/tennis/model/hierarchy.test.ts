import { describe, expect, it } from "vitest";
import type { MatchFormat } from "@/domain/tennis";
import {
  gameWinProb,
  matchGamesDistribution,
  matchWinProb,
  projectMatchProbabilities,
  reconcileSpwToMatchProb,
  setGamesDistribution,
  setOutcomes,
  setWinProb,
  tiebreakWinProb,
} from "./hierarchy";

const BO3: MatchFormat = { bestOf: 3, noAd: false, finalSetRule: "tiebreak7" };
const BO5: MatchFormat = { bestOf: 5, noAd: false, finalSetRule: "tiebreak7" };
const ADV: MatchFormat = { bestOf: 5, noAd: false, finalSetRule: "advantage" };
const MTB: MatchFormat = { bestOf: 3, noAd: false, finalSetRule: "tiebreak10" };

const sumValues = (d: Record<string, number>): number =>
  Object.values(d).reduce((a, b) => a + b, 0);
const meanGames = (d: Record<string, number>): number =>
  Object.entries(d).reduce((m, [k, p]) => m + Number(k) * p, 0);

describe("gameWinProb", () => {
  it("is 0.5 at p=0.5 exactly", () => {
    expect(gameWinProb(0.5)).toBeCloseTo(0.5, 12);
  });

  it("holds ~0.78 at p=0.62 (reference point)", () => {
    // Exact closed-form value is 0.7759; the brief's '~0.80' is a rough anchor.
    expect(gameWinProb(0.62)).toBeGreaterThan(0.75);
    expect(gameWinProb(0.62)).toBeLessThan(0.8);
    expect(gameWinProb(0.62)).toBeCloseTo(0.7759, 3);
  });

  it("is monotonically increasing in p and bounded in [0,1]", () => {
    let prev = -1;
    for (const p of [0.01, 0.3, 0.5, 0.62, 0.75, 0.99]) {
      const h = gameWinProb(p);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(1);
      expect(h).toBeGreaterThan(prev);
      prev = h;
    }
  });

  it("no-ad hold differs from ad hold (sudden-death deuce)", () => {
    // At p>0.5 the server is favoured at deuce, so removing the ad cushion lowers
    // the hold slightly; at p<0.5 it raises it. Either way they must differ.
    expect(gameWinProb(0.62, true)).not.toBeCloseTo(gameWinProb(0.62, false), 4);
  });
});

describe("tiebreakWinProb", () => {
  it("is 0.5 for equal servers", () => {
    expect(tiebreakWinProb(0.62, 0.62)).toBeCloseTo(0.5, 12);
  });

  it("is swap-symmetric: tb(a,b) + tb(b,a) = 1", () => {
    expect(tiebreakWinProb(0.7, 0.6) + tiebreakWinProb(0.6, 0.7)).toBeCloseTo(1, 12);
  });

  it("favours the stronger server", () => {
    expect(tiebreakWinProb(0.75, 0.6)).toBeGreaterThan(0.5);
    expect(tiebreakWinProb(0.6, 0.75)).toBeLessThan(0.5);
  });

  it("a 10-point match tiebreak is more decisive than a 7-point one", () => {
    // More points -> the favourite's edge compounds.
    expect(tiebreakWinProb(0.7, 0.6, 10)).toBeGreaterThan(
      tiebreakWinProb(0.7, 0.6, 7),
    );
  });
});

describe("setOutcomes / set distributions", () => {
  it("set game-score distribution sums to 1", () => {
    expect(sumValues(setGamesDistribution(0.62, 0.62, BO3))).toBeCloseTo(1, 12);
  });

  it("equal servers win a set with prob 0.5", () => {
    expect(setWinProb(0.62, 0.62, BO3)).toBeCloseTo(0.5, 12);
  });

  it("every terminal set score is a legal scoreline", () => {
    for (const o of setOutcomes(0.64, 0.6, BO3, true, false)) {
      const hi = Math.max(o.a, o.b);
      const lo = Math.min(o.a, o.b);
      const legal =
        (hi === 6 && lo <= 4) || (hi === 7 && (lo === 5 || lo === 6));
      expect(legal).toBe(true);
    }
  });

  it("stronger player wins more sets", () => {
    expect(setWinProb(0.7, 0.6, BO3)).toBeGreaterThan(0.5);
  });
});

describe("matchWinProb", () => {
  it("is exactly 0.5 for identical players (coin-toss averaged)", () => {
    expect(matchWinProb(0.62, 0.62, BO3)).toBeCloseTo(0.5, 12);
    expect(matchWinProb(0.62, 0.62, BO5)).toBeCloseTo(0.5, 12);
  });

  it("is swap-symmetric: P(A) + P(B) = 1", () => {
    const a = matchWinProb(0.68, 0.6, BO3);
    const b = matchWinProb(0.6, 0.68, BO3);
    expect(a + b).toBeCloseTo(1, 12);
  });

  it("best-of-5 amplifies the favourite vs best-of-3", () => {
    expect(matchWinProb(0.68, 0.6, BO5)).toBeGreaterThan(
      matchWinProb(0.68, 0.6, BO3),
    );
  });
});

describe("projectMatchProbabilities — distributions", () => {
  it("set-score and games distributions each sum to 1", () => {
    const proj = projectMatchProbabilities({ spwA: 0.66, spwB: 0.61 }, BO3);
    expect(sumValues(proj.setScoreDistribution)).toBeCloseTo(1, 12);
    expect(sumValues(proj.gamesDistribution)).toBeCloseTo(1, 12);
  });

  it("set-score distribution P(A wins) equals pMatchWin", () => {
    const proj = projectMatchProbabilities({ spwA: 0.66, spwB: 0.61 }, BO3);
    const pFromSets = Object.entries(proj.setScoreDistribution)
      .filter(([k]) => Number(k.split("-")[0]) > Number(k.split("-")[1]))
      .reduce((s, [, p]) => s + p, 0);
    expect(pFromSets).toBeCloseTo(proj.pMatchWin, 12);
  });

  it("higher symmetric serve-dominance -> MORE total games (fewer breaks, longer sets)", () => {
    // NOTE: this is the mathematically-correct relationship and intentionally the
    // OPPOSITE of the brief's 'fewer breaks -> lower total games'. Two strong,
    // evenly-matched servers hold easily, so sets reach 6-4/7-5/7-6 -> more games.
    const weak = meanGames(matchGamesDistribution(0.55, 0.55, BO3));
    const strong = meanGames(matchGamesDistribution(0.72, 0.72, BO3));
    expect(strong).toBeGreaterThan(weak);
  });

  it("a large skill GAP yields FEWER total games (blowouts)", () => {
    const even = meanGames(matchGamesDistribution(0.62, 0.62, BO3));
    const lopsided = meanGames(matchGamesDistribution(0.75, 0.5, BO3));
    expect(lopsided).toBeLessThan(even);
  });

  it("advantage and match-tiebreak final-set rules stay normalised", () => {
    const adv = projectMatchProbabilities({ spwA: 0.66, spwB: 0.62 }, ADV);
    const mtb = projectMatchProbabilities({ spwA: 0.66, spwB: 0.62 }, MTB);
    expect(sumValues(adv.setScoreDistribution)).toBeCloseTo(1, 12);
    expect(sumValues(mtb.setScoreDistribution)).toBeCloseTo(1, 12);
    expect(sumValues(adv.gamesDistribution)).toBeCloseTo(1, 12);
    expect(sumValues(mtb.gamesDistribution)).toBeCloseTo(1, 12);
  });
});

describe("reconcileSpwToMatchProb", () => {
  it("shifts the spread so matchWinProb hits the Elo target", () => {
    const target = 0.68;
    const recon = reconcileSpwToMatchProb({ spwA: 0.63, spwB: 0.63 }, target, BO3);
    expect(matchWinProb(recon.spwA, recon.spwB, BO3)).toBeCloseTo(target, 3);
  });

  it("holds combined serve dominance (spwA + spwB) fixed", () => {
    const base = { spwA: 0.63, spwB: 0.63 };
    const recon = reconcileSpwToMatchProb(base, 0.7, BO3);
    expect(recon.spwA + recon.spwB).toBeCloseTo(base.spwA + base.spwB, 6);
  });

  it("a target of 0.5 leaves equal servers unchanged", () => {
    const recon = reconcileSpwToMatchProb({ spwA: 0.62, spwB: 0.62 }, 0.5, BO3);
    expect(recon.spwA).toBeCloseTo(0.62, 4);
    expect(recon.spwB).toBeCloseTo(0.62, 4);
  });
});
