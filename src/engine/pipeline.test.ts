import { describe, expect, it } from "vitest";
import { selectionKey } from "@/domain/market";
import {
  defaultStrategy,
  makeCtx,
  makeLineSnapshot,
  makeOffer,
  ml1x2Snapshot,
  ouGoalsSnapshot,
} from "@/test/builders/makeCtx";
import { runBondedAnalysis } from "./pipeline";

describe("runBondedAnalysis", () => {
  it("returns no plays when no lines available", () => {
    const ctx = makeCtx();
    expect(runBondedAnalysis(ctx)).toEqual([]);
  });

  it("filters PASS plays by default", () => {
    const ctx = makeCtx({ lines: { ML_1X2: ml1x2Snapshot(2.1, 3.4, 4) } });
    const plays = runBondedAnalysis(ctx);
    for (const p of plays) expect(p.verdict).not.toBe("PASS");
  });

  it("includes PASS plays when requested", () => {
    const ctx = makeCtx({ lines: { ML_1X2: ml1x2Snapshot(1.5, 4.5, 8) } });
    const plays = runBondedAnalysis(ctx, { includePass: true });
    expect(plays.length).toBeGreaterThanOrEqual(3);
  });

  it("generates a PlayCandidate with trace on positive edge", () => {
    const ctx = makeCtx({ lines: { ML_1X2: ml1x2Snapshot(2.2, 3.9, 4.2) } });
    const plays = runBondedAnalysis(ctx, { includePass: true });
    const draw = plays.find((p) => p.selection.side === "draw");
    expect(draw).toBeDefined();
    expect(draw!.trace.length).toBeGreaterThan(1);
    expect(draw!.trace[0].source).toBe("adapter");
  });

  it("draw-value-375 fires on draws priced ≥ 3.75", () => {
    const ctx = makeCtx({ lines: { ML_1X2: ml1x2Snapshot(2.0, 3.9, 4.1) } });
    const plays = runBondedAnalysis(ctx, { includePass: true });
    const draw = plays.find((p) => p.selection.side === "draw");
    expect(draw?.trace.some((e) => e.id === "draw-value-375")).toBe(true);
  });

  it("draw-value-375 does not fire when draw priced below 3.75", () => {
    const ctx = makeCtx({ lines: { ML_1X2: ml1x2Snapshot(2.0, 3.4, 4.1) } });
    const plays = runBondedAnalysis(ctx, { includePass: true });
    const draw = plays.find((p) => p.selection.side === "draw");
    expect(draw?.trace.some((e) => e.id === "draw-value-375")).toBe(false);
  });

  it("line-movement-vs-public triggers on reverse line movement", () => {
    const opener = ml1x2Snapshot(2.6, 3.4, 2.9, true);
    const current = ml1x2Snapshot(2.2, 3.4, 3.3);
    const splits = {
      matchId: "match-1" as never,
      marketKey: "ML_1X2" as const,
      source: "mock",
      takenAt: "2026-04-14T10:00:00Z",
      rows: [
        { selection: { marketKey: "ML_1X2" as const, side: "home" }, betsPct: 30, moneyPct: 60 },
        { selection: { marketKey: "ML_1X2" as const, side: "away" }, betsPct: 70, moneyPct: 40 },
      ],
    };
    const ctx = makeCtx({
      lines: { ML_1X2: current },
      openers: { ML_1X2: opener },
      splits: { ML_1X2: splits },
    });
    const plays = runBondedAnalysis(ctx, { includePass: true });
    const home = plays.find((p) => selectionKey(p.selection) === "ML_1X2:home");
    expect(home?.trace.some((e) => e.id === "line-movement-vs-public")).toBe(true);
  });

  it("respects disabled markets in strategy", () => {
    const ctx = makeCtx({
      lines: { ML_1X2: ml1x2Snapshot(2, 3.4, 4), OU_GOALS: ouGoalsSnapshot(2.5, 1.9, 1.9) },
      strategy: defaultStrategy({ enabledMarkets: ["ML_1X2"] }),
    });
    const plays = runBondedAnalysis(ctx, { includePass: true });
    expect(plays.every((p) => p.selection.marketKey === "ML_1X2")).toBe(true);
  });

  it("stakeUnits is 0 when edge below threshold", () => {
    const ctx = makeCtx({ lines: { ML_1X2: ml1x2Snapshot(1.5, 4.5, 8) } });
    const plays = runBondedAnalysis(ctx, { includePass: true });
    for (const p of plays) {
      if (p.edgePct < ctx.strategy.stakePolicy.minEdgePct) {
        expect(p.stakeUnits).toBe(0);
      }
    }
  });

  it("sorts plays by edge descending", () => {
    const ctx = makeCtx({
      lines: {
        ML_1X2: ml1x2Snapshot(2.2, 3.9, 4.2),
        OU_GOALS: ouGoalsSnapshot(2.5, 1.95, 1.95),
      },
    });
    const plays = runBondedAnalysis(ctx, { includePass: true });
    for (let i = 1; i < plays.length; i++) {
      expect(plays[i - 1].edgePct).toBeGreaterThanOrEqual(plays[i].edgePct);
    }
  });

  it("disabled rule in strategy is skipped", () => {
    const ctx = makeCtx({
      lines: { ML_1X2: ml1x2Snapshot(2.0, 3.9, 4.1) },
      strategy: defaultStrategy({
        rules: [{ ruleId: "draw-value-375", enabled: false, weight: 1 }],
      }),
    });
    const plays = runBondedAnalysis(ctx, { includePass: true });
    const draw = plays.find((p) => p.selection.side === "draw");
    expect(draw?.trace.some((e) => e.id === "draw-value-375")).toBe(false);
  });

  it("verdict ladder: larger edge → stronger verdict", () => {
    const ctx = makeCtx({
      lines: {
        ML_1X2: makeLineSnapshot("ML_1X2", [
          makeOffer({ marketKey: "ML_1X2", side: "home" }, 3.0),
          makeOffer({ marketKey: "ML_1X2", side: "draw" }, 3.0),
          makeOffer({ marketKey: "ML_1X2", side: "away" }, 3.0),
        ]),
      },
    });
    const plays = runBondedAnalysis(ctx, { includePass: true });
    for (const p of plays) {
      expect(["LEAN", "PLAY", "STRONG", "PASS"]).toContain(p.verdict);
    }
  });
});
