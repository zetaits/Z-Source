import { describe, expect, it } from "vitest";
import { MatchId } from "@/domain/ids";
import type { MarketKey } from "@/domain/market";
import type { Splits } from "@/domain/splits";
import { makeCtx, makeLineSnapshot, makeOffer, ml1x2Snapshot } from "@/test/builders/makeCtx";
import { runBondedAnalysis } from "../pipeline";

const splitsFor = (
  marketKey: MarketKey,
  rows: { side: string; line?: number; betsPct: number; moneyPct?: number }[],
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

const detectorEntry = (plays: ReturnType<typeof runBondedAnalysis>, side: string) => {
  const play = plays.find((p) => p.selection.side === side);
  return play?.trace.find((e) => e.id === "sharp-square-detector");
};

describe("sharpSquareDetector", () => {
  describe("REVERSE_LINE_MOVEMENT", () => {
    it("fires SUPPORT when few tickets but line shortened significantly", () => {
      const ctx = makeCtx({
        lines: { ML_1X2: ml1x2Snapshot(2.2, 3.4, 3.3) },
        openers: { ML_1X2: ml1x2Snapshot(2.6, 3.4, 2.9, true) },
        splits: {
          ML_1X2: splitsFor("ML_1X2", [
            { side: "home", betsPct: 30, moneyPct: 60 },
            { side: "away", betsPct: 70, moneyPct: 40 },
          ]),
        },
      });
      const plays = runBondedAnalysis(ctx, { includePass: true });
      const entry = detectorEntry(plays, "home");
      expect(entry?.verdict).toBe("SUPPORT");
      expect(entry?.data?.pattern).toBe("REVERSE_LINE_MOVEMENT");
    });

    it("does not fire when public backing is heavy despite line move", () => {
      const ctx = makeCtx({
        lines: { ML_1X2: ml1x2Snapshot(2.2, 3.4, 3.3) },
        openers: { ML_1X2: ml1x2Snapshot(2.6, 3.4, 2.9, true) },
        splits: {
          ML_1X2: splitsFor("ML_1X2", [
            { side: "home", betsPct: 65, moneyPct: 60 },
            { side: "away", betsPct: 35, moneyPct: 40 },
          ]),
        },
      });
      const plays = runBondedAnalysis(ctx, { includePass: true });
      const entry = detectorEntry(plays, "home");
      expect(entry?.data?.pattern).not.toBe("REVERSE_LINE_MOVEMENT");
    });
  });

  describe("PUBLIC_DOG_TRAP_CONFIRMED", () => {
    it("fires AGAINST underdog with heavy public tickets and stable line", () => {
      // away @ 3.9 is underdog, 65% public on it, line not dropped
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
      const entry = detectorEntry(plays, "away");
      expect(entry?.verdict).toBe("AGAINST");
      expect(entry?.data?.pattern).toBe("PUBLIC_DOG_TRAP_CONFIRMED");
    });

    it("does not fire against the favorite even with heavy public", () => {
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
      const homeEntry = detectorEntry(plays, "home");
      expect(homeEntry?.data?.pattern).not.toBe("PUBLIC_DOG_TRAP_CONFIRMED");
    });
  });

  describe("SHARP_MONEY_DIVERGENCE", () => {
    it("fires SUPPORT when money % exceeds tickets % by ≥15 pts", () => {
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
      const entry = detectorEntry(plays, "home");
      expect(entry?.verdict).toBe("SUPPORT");
      expect(entry?.data?.pattern).toBe("SHARP_MONEY_DIVERGENCE");
    });

    it("does not fire when money and tickets are aligned", () => {
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
        expect(p.trace.find((e) => e.id === "sharp-square-detector")).toBeUndefined();
      }
    });
  });

  describe("HEAVY_PUBLIC_NO_DIVERGENCE", () => {
    it("emits nothing when public heavy but money agrees and line stable (no fade trap)", () => {
      // Scenario: Madrid @ 1.6, 80% tickets, 78% money, line unchanged — real consensus
      const ctx = makeCtx({
        lines: { ML_1X2: ml1x2Snapshot(1.6, 3.9, 5.5) },
        splits: {
          ML_1X2: splitsFor("ML_1X2", [
            { side: "home", betsPct: 80, moneyPct: 78 },
            { side: "draw", betsPct: 12, moneyPct: 12 },
            { side: "away", betsPct: 8, moneyPct: 10 },
          ]),
        },
      });
      const plays = runBondedAnalysis(ctx, { includePass: true });
      const home = plays.find((p) => p.selection.side === "home");
      expect(home?.trace.find((e) => e.id === "sharp-square-detector")).toBeUndefined();
    });
  });

  describe("PURE_FADE_PUBLIC", () => {
    it("fires AGAINST when ≥80% tickets and no money/line context", () => {
      const ctx = makeCtx({
        lines: { ML_1X2: ml1x2Snapshot(1.6, 3.9, 5.5) },
        splits: {
          // moneyPct intentionally undefined
          ML_1X2: splitsFor("ML_1X2", [
            { side: "home", betsPct: 82 },
            { side: "draw", betsPct: 10 },
            { side: "away", betsPct: 8 },
          ]),
        },
      });
      const plays = runBondedAnalysis(ctx, { includePass: true });
      const entry = detectorEntry(plays, "home");
      expect(entry?.verdict).toBe("AGAINST");
      expect(entry?.data?.pattern).toBe("PURE_FADE_PUBLIC");
    });
  });

  describe("no splits → no output", () => {
    it("emits nothing when splits are absent (defers to lineMovementVsPublic)", () => {
      const ctx = makeCtx({
        lines: { ML_1X2: ml1x2Snapshot(2.2, 3.4, 3.3) },
      });
      const plays = runBondedAnalysis(ctx, { includePass: true });
      for (const p of plays) {
        expect(p.trace.find((e) => e.id === "sharp-square-detector")).toBeUndefined();
      }
    });
  });

  describe("lineMovementVsPublic fallback", () => {
    it("fires when no splits and line moved ≥5%", () => {
      const ctx = makeCtx({
        lines: { ML_1X2: ml1x2Snapshot(2.2, 3.4, 3.3) },
        openers: { ML_1X2: ml1x2Snapshot(2.6, 3.4, 2.9, true) },
        // no splits
      });
      const plays = runBondedAnalysis(ctx, { includePass: true });
      const home = plays.find((p) => p.selection.side === "home");
      expect(home?.trace.some((e) => e.id === "line-movement-vs-public")).toBe(true);
    });

    it("does not fire when splits are present (yields to detector)", () => {
      const ctx = makeCtx({
        lines: { ML_1X2: ml1x2Snapshot(2.2, 3.4, 3.3) },
        openers: { ML_1X2: ml1x2Snapshot(2.6, 3.4, 2.9, true) },
        splits: {
          ML_1X2: splitsFor("ML_1X2", [
            { side: "home", betsPct: 30, moneyPct: 60 },
            { side: "away", betsPct: 70, moneyPct: 40 },
          ]),
        },
      });
      const plays = runBondedAnalysis(ctx, { includePass: true });
      for (const p of plays) {
        expect(p.trace.find((e) => e.id === "line-movement-vs-public")).toBeUndefined();
      }
    });
  });
});
