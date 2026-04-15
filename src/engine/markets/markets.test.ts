import { describe, expect, it } from "vitest";
import {
  bttsSnapshot,
  makeCtx,
  makeLineSnapshot,
  makeOffer,
  ml1x2Snapshot,
  ouGoalsSnapshot,
} from "@/test/builders/makeCtx";
import { asianHandicap } from "./asianHandicap";
import { btts } from "./btts";
import { drawNoBet } from "./drawNoBet";
import { mlMoneyline } from "./mlMoneyline";
import { overUnderGoals } from "./overUnderGoals";

describe("MarketAdapters", () => {
  it("ML_1X2 enumerates home/draw/away", () => {
    const ctx = makeCtx({ lines: { ML_1X2: ml1x2Snapshot(2, 3.4, 4) } });
    const sides = mlMoneyline.enumerate(ctx).map((s) => s.side);
    expect(sides).toEqual(["home", "draw", "away"]);
  });

  it("ML_1X2 vig-free probs sum to ~1", () => {
    const ctx = makeCtx({ lines: { ML_1X2: ml1x2Snapshot(2.1, 3.4, 4) } });
    const p =
      (mlMoneyline.vigFreeProb({ marketKey: "ML_1X2", side: "home" }, ctx) ?? 0) +
      (mlMoneyline.vigFreeProb({ marketKey: "ML_1X2", side: "draw" }, ctx) ?? 0) +
      (mlMoneyline.vigFreeProb({ marketKey: "ML_1X2", side: "away" }, ctx) ?? 0);
    expect(p).toBeCloseTo(1, 5);
  });

  it("ML_1X2 bestPrice picks highest decimal across books", () => {
    const snap = makeLineSnapshot("ML_1X2", [
      makeOffer({ marketKey: "ML_1X2", side: "home" }, 2.0, "bookA"),
      makeOffer({ marketKey: "ML_1X2", side: "home" }, 2.15, "bookB"),
      makeOffer({ marketKey: "ML_1X2", side: "home" }, 1.95, "bookC"),
    ]);
    const ctx = makeCtx({ lines: { ML_1X2: snap } });
    expect(mlMoneyline.bestPrice({ marketKey: "ML_1X2", side: "home" }, ctx)?.decimal).toBe(2.15);
  });

  it("DNB returns undefined vig-free when side missing", () => {
    const snap = makeLineSnapshot("DNB", [
      makeOffer({ marketKey: "DNB", side: "home" }, 1.9),
    ]);
    const ctx = makeCtx({ lines: { DNB: snap } });
    expect(drawNoBet.vigFreeProb({ marketKey: "DNB", side: "home" }, ctx)).toBeUndefined();
  });

  it("OU_GOALS enumerates unique lines in pairs", () => {
    const snap = makeLineSnapshot("OU_GOALS", [
      makeOffer({ marketKey: "OU_GOALS", side: "over", line: 2.5 }, 1.9),
      makeOffer({ marketKey: "OU_GOALS", side: "under", line: 2.5 }, 1.9),
      makeOffer({ marketKey: "OU_GOALS", side: "over", line: 3.5 }, 2.6),
      makeOffer({ marketKey: "OU_GOALS", side: "under", line: 3.5 }, 1.45),
    ]);
    const ctx = makeCtx({ lines: { OU_GOALS: snap } });
    const enumed = overUnderGoals.enumerate(ctx);
    expect(enumed).toHaveLength(4);
    const lines = Array.from(new Set(enumed.map((s) => s.line!)));
    expect(lines.sort()).toEqual([2.5, 3.5]);
  });

  it("OU_GOALS vig-free pairs on same line", () => {
    const ctx = makeCtx({ lines: { OU_GOALS: ouGoalsSnapshot(2.5, 1.95, 1.85) } });
    const over = overUnderGoals.vigFreeProb({ marketKey: "OU_GOALS", side: "over", line: 2.5 }, ctx) ?? 0;
    const under = overUnderGoals.vigFreeProb({ marketKey: "OU_GOALS", side: "under", line: 2.5 }, ctx) ?? 0;
    expect(over + under).toBeCloseTo(1, 5);
    expect(under).toBeGreaterThan(over);
  });

  it("BTTS yields yes/no pair", () => {
    const ctx = makeCtx({ lines: { BTTS: bttsSnapshot(1.8, 2.0) } });
    const yes = btts.vigFreeProb({ marketKey: "BTTS", side: "yes" }, ctx) ?? 0;
    const no = btts.vigFreeProb({ marketKey: "BTTS", side: "no" }, ctx) ?? 0;
    expect(yes + no).toBeCloseTo(1, 5);
    expect(yes).toBeGreaterThan(no);
  });

  it("AH pairs mirrored lines between home/away", () => {
    const snap = makeLineSnapshot("AH", [
      makeOffer({ marketKey: "AH", side: "home", line: -0.5 }, 1.95),
      makeOffer({ marketKey: "AH", side: "away", line: 0.5 }, 1.85),
    ]);
    const ctx = makeCtx({ lines: { AH: snap } });
    const pHome = asianHandicap.vigFreeProb(
      { marketKey: "AH", side: "home", line: -0.5 },
      ctx,
    );
    expect(pHome).toBeGreaterThan(0);
    expect(pHome).toBeLessThan(1);
  });
});
