import { describe, expect, it } from "vitest";
import { MatchId } from "@/domain/ids";
import type { MarketKey } from "@/domain/market";
import type { Splits } from "@/domain/splits";
import { makeCtx, ml1x2Snapshot } from "@/test/builders/makeCtx";
import { runBondedAnalysis } from "../pipeline";

const splitsFor = (
  marketKey: MarketKey,
  rows: { side: string; line?: number; betsPct: number; moneyPct: number }[],
): Splits => ({
  matchId: MatchId("match-1"),
  marketKey,
  source: "mock",
  takenAt: "2026-04-14T10:00:00Z",
  rows: rows.map((r) => ({
    selection: { marketKey, side: r.side, line: r.line },
    betsPct: r.betsPct,
    moneyPct: r.moneyPct,
  })),
});

describe("fade-the-public rule", () => {
  it("fires AGAINST the heavily backed side", () => {
    const ctx = makeCtx({
      lines: { ML_1X2: ml1x2Snapshot(1.6, 3.9, 5.5) },
      splits: {
        ML_1X2: splitsFor("ML_1X2", [
          { side: "home", betsPct: 80, moneyPct: 60 },
          { side: "draw", betsPct: 10, moneyPct: 15 },
          { side: "away", betsPct: 10, moneyPct: 25 },
        ]),
      },
    });
    const plays = runBondedAnalysis(ctx, { includePass: true });
    const home = plays.find((p) => p.selection.side === "home");
    const entry = home?.trace.find((e) => e.id === "fade-the-public");
    expect(entry?.verdict).toBe("AGAINST");
  });

  it("does not fire when public is balanced", () => {
    const ctx = makeCtx({
      lines: { ML_1X2: ml1x2Snapshot(2.2, 3.4, 3.2) },
      splits: {
        ML_1X2: splitsFor("ML_1X2", [
          { side: "home", betsPct: 40, moneyPct: 45 },
          { side: "draw", betsPct: 25, moneyPct: 20 },
          { side: "away", betsPct: 35, moneyPct: 35 },
        ]),
      },
    });
    const plays = runBondedAnalysis(ctx, { includePass: true });
    for (const p of plays) {
      expect(p.trace.find((e) => e.id === "fade-the-public")).toBeUndefined();
    }
  });
});

describe("sharp-money-against-public rule", () => {
  it("fires SUPPORT when money % exceeds bets % by ≥15 pts", () => {
    const ctx = makeCtx({
      lines: { ML_1X2: ml1x2Snapshot(2.2, 3.4, 3.2) },
      splits: {
        ML_1X2: splitsFor("ML_1X2", [
          { side: "home", betsPct: 30, moneyPct: 60 },
          { side: "draw", betsPct: 20, moneyPct: 18 },
          { side: "away", betsPct: 50, moneyPct: 22 },
        ]),
      },
    });
    const plays = runBondedAnalysis(ctx, { includePass: true });
    const home = plays.find((p) => p.selection.side === "home");
    const entry = home?.trace.find((e) => e.id === "sharp-money-against-public");
    expect(entry?.verdict).toBe("SUPPORT");
  });

  it("does not fire when money/bets are aligned", () => {
    const ctx = makeCtx({
      lines: { ML_1X2: ml1x2Snapshot(2.2, 3.4, 3.2) },
      splits: {
        ML_1X2: splitsFor("ML_1X2", [
          { side: "home", betsPct: 50, moneyPct: 52 },
          { side: "draw", betsPct: 20, moneyPct: 18 },
          { side: "away", betsPct: 30, moneyPct: 30 },
        ]),
      },
    });
    const plays = runBondedAnalysis(ctx, { includePass: true });
    for (const p of plays) {
      expect(p.trace.find((e) => e.id === "sharp-money-against-public")).toBeUndefined();
    }
  });
});

describe("public-underdog-trap rule", () => {
  it("fires AGAINST when public piles onto a priced underdog", () => {
    const ctx = makeCtx({
      lines: { ML_1X2: ml1x2Snapshot(1.9, 3.4, 3.9) },
      splits: {
        ML_1X2: splitsFor("ML_1X2", [
          { side: "home", betsPct: 20, moneyPct: 45 },
          { side: "draw", betsPct: 15, moneyPct: 15 },
          { side: "away", betsPct: 65, moneyPct: 40 },
        ]),
      },
    });
    const plays = runBondedAnalysis(ctx, { includePass: true });
    const away = plays.find((p) => p.selection.side === "away");
    const entry = away?.trace.find((e) => e.id === "public-underdog-trap");
    expect(entry?.verdict).toBe("AGAINST");
  });

  it("skips favorites even with heavy public", () => {
    const ctx = makeCtx({
      lines: { ML_1X2: ml1x2Snapshot(1.5, 4.0, 6.0) },
      splits: {
        ML_1X2: splitsFor("ML_1X2", [
          { side: "home", betsPct: 70, moneyPct: 60 },
          { side: "draw", betsPct: 15, moneyPct: 20 },
          { side: "away", betsPct: 15, moneyPct: 20 },
        ]),
      },
    });
    const plays = runBondedAnalysis(ctx, { includePass: true });
    const home = plays.find((p) => p.selection.side === "home");
    expect(home?.trace.find((e) => e.id === "public-underdog-trap")).toBeUndefined();
  });
});
