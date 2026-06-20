import { describe, expect, it } from "vitest";
import type {
  BatterKSplits,
  LineupSlot,
  PitcherGameLog,
  PitcherSeasonStats,
  SavantPitcherProfile,
} from "@/domain/baseball";
import { LEAGUE_K_RATE } from "./constants";
import { projectStrikeouts } from "./kProjection";
import type { ProjectStrikeoutsArgs } from "./types";

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

const pitcher: PitcherSeasonStats = {
  playerId: 100,
  season: 2025,
  gamesStarted: 30,
  gamesPlayed: 30,
  inningsPitched: 180,
  battersFaced: 720,
  strikeouts: 216, // 30% K rate
  kPct: 0.3,
  kPer9: 10.8,
  strikePct: 0.66,
};

const savant: SavantPitcherProfile = {
  playerId: 100,
  season: 2025,
  whiffPct: 0.15,
};

const gamelogs: PitcherGameLog[] = Array.from({ length: 8 }, (_, i) => ({
  gamePk: 1000 + i,
  date: `2025-0${(i % 6) + 1}-1${i}`,
  isHome: i % 2 === 0,
  inningsPitched: 6,
  battersFaced: 24,
  strikeouts: 7,
  gamesStarted: 1,
}));

const lineup: LineupSlot[] = Array.from({ length: 9 }, (_, i) => ({
  battingOrder: i + 1,
  playerId: 200 + i,
  name: `Batter ${i + 1}`,
  bats: (i % 2 === 0 ? "R" : "L") as "R" | "L",
}));

const batterSplits: Record<number, BatterKSplits> = Object.fromEntries(
  lineup.map((s) => [
    s.playerId,
    {
      playerId: s.playerId,
      season: 2025,
      kPctVsR: 0.24,
      kPctVsL: 0.21,
      paVsR: 300,
      paVsL: 120,
    } satisfies BatterKSplits,
  ]),
);

const fullArgs: ProjectStrikeoutsArgs = {
  pitcher,
  throws: "R",
  gamelogs,
  savant,
  opponentLineup: lineup,
  batterSplits,
};

describe("projectStrikeouts — BF outing-length anchor (regression)", () => {
  // Reliever/opener: no recent starts, no season starts (BF default), no Outs line.
  const reliever: PitcherSeasonStats = {
    ...pitcher,
    gamesStarted: 0,
    battersFaced: 0,
    inningsPitched: 0,
    strikeouts: 0,
    kPct: 0.3,
  };
  const noAnchorArgs: ProjectStrikeoutsArgs = {
    ...fullArgs,
    pitcher: reliever,
    gamelogs: [], // no starts
  };

  it("unanchored (no Outs line, no recent starts) → bfAnchored false + confidence below bet floor", () => {
    const proj = projectStrikeouts(noAnchorArgs);
    expect(proj.inputsUsed.bfAnchored).toBe(false);
    // Must drop below MIN_CONFIDENCE (0.45) so analyze() never emits a play —
    // this is what stops openers being over-projected (the Newcomb case).
    expect(proj.confidence).toBeLessThan(0.45);
  });

  it("a Pitcher Outs O/U line re-anchors an otherwise unanchored pitcher", () => {
    const proj = projectStrikeouts({ ...noAnchorArgs, marketOutsLine: 18 });
    expect(proj.inputsUsed.bfAnchored).toBe(true);
    expect(proj.inputsUsed.usedMarketOutsLine).toBe(true);
  });

  it("outs→BF uses outs/(1-r), NOT outs/3 — 16.5 outs ≈ 24 BF, not ~8", () => {
    // Season BF/start = 24 (720/30). With Outs 16.5 the blended bfMean must stay
    // in a real start range (>20). The old buggy /3 formula gave ~8 → ~16 blended.
    const starter: PitcherSeasonStats = { ...pitcher };
    const proj = projectStrikeouts({
      ...fullArgs,
      pitcher: starter,
      gamelogs: [],
      marketOutsLine: 16.5,
    });
    expect(proj.inputsUsed.usedMarketOutsLine).toBe(true);
    expect(proj.inputsUsed.bfMean).toBeGreaterThan(20);
  });
});

describe("projectStrikeouts — full tier", () => {
  it("returns a normalized pmf and a sensible expected K count", () => {
    const proj = projectStrikeouts(fullArgs);
    expect(sum(proj.pmf)).toBeCloseTo(1, 8);
    // ~24 BF * ~26% per-PA -> roughly 6 Ks; loose bounds.
    expect(proj.expectedKs).toBeGreaterThan(3);
    expect(proj.expectedKs).toBeLessThan(9);
    expect(proj.inputsUsed.tier).toBe("full");
    expect(proj.inputsUsed.savantSource).toBe("swstr");
    expect(proj.inputsUsed.lineupConfirmed).toBe(true);
  });

  it("pmfMean equals Σ k·pmf[k] (pOver/expected consistency)", () => {
    const proj = projectStrikeouts(fullArgs);
    let m = 0;
    proj.pmf.forEach((p, k) => (m += k * p));
    expect(proj.expectedKs).toBeCloseTo(m, 12);
  });

  it("pOver is monotonically non-increasing in the line", () => {
    const proj = projectStrikeouts(fullArgs);
    let prev = 1.1;
    for (const line of [3.5, 4.5, 5.5, 6.5, 7.5]) {
      const p = proj.pOver(line);
      expect(p).toBeLessThanOrEqual(prev + 1e-12);
      expect(p).toBeGreaterThanOrEqual(0);
      prev = p;
    }
  });

  it("confidence is in [0,1] and highest at full tier", () => {
    const proj = projectStrikeouts(fullArgs);
    expect(proj.confidence).toBeGreaterThan(0);
    expect(proj.confidence).toBeLessThanOrEqual(1);
  });
});

describe("projectStrikeouts — degradation tiers", () => {
  it("falls to partial when lineup is unconfirmed", () => {
    const proj = projectStrikeouts({ ...fullArgs, opponentLineup: [] });
    expect(proj.inputsUsed.tier).toBe("partial");
    expect(proj.inputsUsed.lineupConfirmed).toBe(false);
    expect(proj.inputsUsed.battersModeled).toBe(9);
    expect(sum(proj.pmf)).toBeCloseTo(1, 8);
  });

  it("falls to low when no Savant stuff is present", () => {
    const proj = projectStrikeouts({ ...fullArgs, savant: undefined });
    expect(proj.inputsUsed.tier).toBe("low");
    expect(proj.inputsUsed.savantSource).toBe("none");
    // season-only path: talent should track the shrunk season rate, no stuff blend.
    expect(proj.inputsUsed.pitcherTalentK).toBeGreaterThan(LEAGUE_K_RATE);
  });

  it("confidence reflects true severity: full > no-Savant > no-lineup", () => {
    // Missing the lineup is a MAJOR gap (synthesized batters); missing Savant is
    // MINOR (season K% still carries it). So a confirmed lineup without Savant
    // must out-rank an unconfirmed lineup — independent, not an ordered tier.
    const full = projectStrikeouts(fullArgs).confidence;
    const noSavant = projectStrikeouts({ ...fullArgs, savant: undefined }).confidence;
    const noLineup = projectStrikeouts({ ...fullArgs, opponentLineup: [] }).confidence;
    expect(full).toBeGreaterThan(noSavant);
    expect(noSavant).toBeGreaterThan(noLineup);
  });
});

describe("projectStrikeouts — market outs blend & robustness", () => {
  it("uses marketOutsLine when provided and flags it", () => {
    const base = projectStrikeouts(fullArgs);
    const withMarket = projectStrikeouts({ ...fullArgs, marketOutsLine: 18 });
    expect(withMarket.inputsUsed.usedMarketOutsLine).toBe(true);
    expect(base.inputsUsed.usedMarketOutsLine).toBe(false);
    // 18 outs -> ~8.7 BF inflation factor -> lower BF mean than 24 -> shifts mean.
    expect(withMarket.inputsUsed.bfMean).not.toBeCloseTo(base.inputsUsed.bfMean, 3);
  });

  it("never throws and returns a valid pmf with empty gamelogs and no splits", () => {
    const proj = projectStrikeouts({
      pitcher,
      throws: "L",
      gamelogs: [],
      opponentLineup: [],
      batterSplits: {},
    });
    expect(sum(proj.pmf)).toBeCloseTo(1, 8);
    expect(Number.isFinite(proj.expectedKs)).toBe(true);
    expect(proj.inputsUsed.bfMean).toBeGreaterThan(0);
  });

  it("higher pitcher talent yields a higher expected K count", () => {
    const lowK = projectStrikeouts({
      ...fullArgs,
      pitcher: { ...pitcher, kPct: 0.16, strikeouts: 115 },
      savant: { ...savant, whiffPct: 0.09 },
    });
    const highK = projectStrikeouts(fullArgs);
    expect(highK.expectedKs).toBeGreaterThan(lowK.expectedKs);
  });
});
