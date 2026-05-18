import { describe, expect, it } from "vitest";
import type { TeamForm } from "@/domain/history";
import { TeamId } from "@/domain/ids";
import type { MarketKey } from "@/domain/market";
import {
  defaultStrategy,
  makeCtx,
  makeLineSnapshot,
  makeOffer,
  ml1x2Snapshot,
} from "@/test/builders/makeCtx";
import { runBondedAnalysis } from "../pipeline";

const ALL_MARKETS: MarketKey[] = [
  "ML_1X2",
  "DNB",
  "AH",
  "OU_GOALS",
  "BTTS",
  "BTTS_1H",
  "BTTS_2H",
  "DC",
  "TTG_HOME",
  "TTG_AWAY",
];

const strategy = defaultStrategy({ enabledMarkets: ALL_MARKETS });

const makeForm = (
  teamId: string,
  overrides: Partial<Omit<TeamForm, "teamId">> = {},
): TeamForm => ({
  teamId: TeamId(teamId),
  lastN: 6,
  games: [],
  goalsFor: 0,
  goalsAgainst: 0,
  cleanSheets: 0,
  bttsRate: 0,
  ppgLast: 1.5,
  ...overrides,
});

describe("doubleChance adapter", () => {
  it("enumerates 1X/12/X2 from ML offers when no DC offers present", () => {
    const ctx = makeCtx({
      strategy,
      lines: { ML_1X2: ml1x2Snapshot(2.2, 3.4, 3.2) },
    });
    const { candidates } = runBondedAnalysis(ctx, { includePass: true });
    const dcCands = candidates.filter((c) => c.selection.marketKey === "DC");
    const sides = new Set(dcCands.map((c) => c.selection.side));
    expect(sides.has("1X")).toBe(true);
    expect(sides.has("12")).toBe(true);
    expect(sides.has("X2")).toBe(true);
  });

  it("vigFree probs from ML sum to ~2 across the three DC sides", () => {
    const ctx = makeCtx({
      strategy,
      lines: { ML_1X2: ml1x2Snapshot(2.2, 3.4, 3.2) },
    });
    const { candidates } = runBondedAnalysis(ctx, { includePass: true });
    const dcCands = candidates.filter((c) => c.selection.marketKey === "DC");
    const sumFair = dcCands.reduce((s, c) => s + c.fairProb, 0);
    expect(sumFair).toBeGreaterThan(1.8);
    expect(sumFair).toBeLessThan(2.2);
  });

  it("uses real DC offers when present (different book than synthetic)", () => {
    const ctx = makeCtx({
      strategy,
      lines: {
        ML_1X2: ml1x2Snapshot(2.2, 3.4, 3.2),
        DC: makeLineSnapshot("DC", [
          makeOffer({ marketKey: "DC", side: "1X" }, 1.35),
          makeOffer({ marketKey: "DC", side: "12" }, 1.30),
          makeOffer({ marketKey: "DC", side: "X2" }, 1.65),
        ]),
      },
    });
    const { candidates } = runBondedAnalysis(ctx, { includePass: true });
    const onex = candidates.find(
      (c) => c.selection.marketKey === "DC" && c.selection.side === "1X",
    );
    expect(onex?.price.book).not.toBe("synthetic-from-ml");
    expect(onex?.price.decimal).toBeCloseTo(1.35, 2);
  });
});

describe("teamTotalGoals adapter", () => {
  it("enumerates over/under for each available line", () => {
    const ctx = makeCtx({
      strategy,
      lines: {
        TTG_HOME: makeLineSnapshot("TTG_HOME", [
          makeOffer({ marketKey: "TTG_HOME", side: "over", line: 1.5 }, 1.85),
          makeOffer({ marketKey: "TTG_HOME", side: "under", line: 1.5 }, 1.95),
        ]),
      },
    });
    const { candidates } = runBondedAnalysis(ctx, { includePass: true });
    const ttg = candidates.filter((c) => c.selection.marketKey === "TTG_HOME");
    expect(ttg.length).toBe(2);
    expect(ttg.some((c) => c.selection.side === "over")).toBe(true);
    expect(ttg.some((c) => c.selection.side === "under")).toBe(true);
  });

  it("does not enumerate without offers", () => {
    const ctx = makeCtx({ strategy, lines: {} });
    const { candidates } = runBondedAnalysis(ctx, { includePass: true });
    expect(
      candidates.filter((c) => c.selection.marketKey === "TTG_HOME").length,
    ).toBe(0);
  });
});

describe("bttsHalves adapter", () => {
  it("enumerates yes/no when offers present", () => {
    const ctx = makeCtx({
      strategy,
      lines: {
        BTTS_1H: makeLineSnapshot("BTTS_1H", [
          makeOffer({ marketKey: "BTTS_1H", side: "yes" }, 4.5),
          makeOffer({ marketKey: "BTTS_1H", side: "no" }, 1.2),
        ]),
      },
    });
    const { candidates } = runBondedAnalysis(ctx, { includePass: true });
    const halves = candidates.filter((c) => c.selection.marketKey === "BTTS_1H");
    expect(halves.length).toBe(2);
  });

  it("skips silently when no offers", () => {
    const ctx = makeCtx({ strategy, lines: {} });
    const { candidates } = runBondedAnalysis(ctx, { includePass: true });
    expect(
      candidates.filter((c) => c.selection.marketKey === "BTTS_1H").length,
    ).toBe(0);
  });
});

describe("doubleChanceDcModel rule", () => {
  it("does NOT fire when DC price is synthetic from ML (circular guard)", () => {
    const ctx = makeCtx({
      strategy,
      lines: { ML_1X2: ml1x2Snapshot(2.2, 3.4, 3.2) },
      homeForm: makeForm("home", { xGForLast: 12, xGAgainstLast: 7, lastN: 6 }),
      awayForm: makeForm("away", { xGForLast: 5, xGAgainstLast: 9, lastN: 6 }),
    });
    const { candidates } = runBondedAnalysis(ctx, { includePass: true });
    const dcCands = candidates.filter((c) => c.selection.marketKey === "DC");
    for (const c of dcCands) {
      expect(c.trace.find((e) => e.id === "dc-xg-model")).toBeUndefined();
    }
  });

  it("fires with real DC offers when DC model disagrees with market", () => {
    // Real DC offers: 1X heavily favoured by market
    const ctx = makeCtx({
      strategy,
      lines: {
        ML_1X2: ml1x2Snapshot(2.0, 3.5, 4.0),
        DC: makeLineSnapshot("DC", [
          makeOffer({ marketKey: "DC", side: "1X" }, 1.25),
          makeOffer({ marketKey: "DC", side: "12" }, 1.40),
          makeOffer({ marketKey: "DC", side: "X2" }, 2.20),
        ]),
      },
      homeForm: makeForm("home", { xGForLast: 6, xGAgainstLast: 9, lastN: 6 }),
      awayForm: makeForm("away", { xGForLast: 12, xGAgainstLast: 6, lastN: 6 }),
    });
    const { candidates } = runBondedAnalysis(ctx, { includePass: true });
    const x2 = candidates.find(
      (c) => c.selection.marketKey === "DC" && c.selection.side === "X2",
    );
    const entry = x2?.trace.find((e) => e.id === "dc-xg-model");
    expect(entry?.verdict).toBe("SUPPORT");
    expect(entry?.data?.rho).toBe(0.13);
  });
});

describe("teamTotalsXgDc rule", () => {
  it("fires SUPPORT for home over when home xG strong", () => {
    const ctx = makeCtx({
      strategy,
      lines: {
        TTG_HOME: makeLineSnapshot("TTG_HOME", [
          makeOffer({ marketKey: "TTG_HOME", side: "over", line: 1.5 }, 2.20),
          makeOffer({ marketKey: "TTG_HOME", side: "under", line: 1.5 }, 1.65),
        ]),
      },
      homeForm: makeForm("home", { xGForLast: 14, xGAgainstLast: 5, lastN: 6 }),
      awayForm: makeForm("away", { xGForLast: 6, xGAgainstLast: 8, lastN: 6 }),
    });
    const { candidates } = runBondedAnalysis(ctx, { includePass: true });
    const over = candidates.find(
      (c) =>
        c.selection.marketKey === "TTG_HOME" &&
        c.selection.side === "over" &&
        c.selection.line === 1.5,
    );
    const entry = over?.trace.find((e) => e.id === "ttg-xg-dc");
    expect(entry?.verdict).toBe("SUPPORT");
    expect(entry?.data?.rho).toBe(0.13);
  });

  it("does not fire without xG", () => {
    const ctx = makeCtx({
      strategy,
      lines: {
        TTG_HOME: makeLineSnapshot("TTG_HOME", [
          makeOffer({ marketKey: "TTG_HOME", side: "over", line: 1.5 }, 1.9),
          makeOffer({ marketKey: "TTG_HOME", side: "under", line: 1.5 }, 1.9),
        ]),
      },
      homeForm: makeForm("home"),
      awayForm: makeForm("away"),
    });
    const { candidates } = runBondedAnalysis(ctx, { includePass: true });
    for (const c of candidates) {
      expect(c.trace.find((e) => e.id === "ttg-xg-dc")).toBeUndefined();
    }
  });
});
