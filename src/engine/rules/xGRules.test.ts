import { describe, expect, it } from "vitest";
import type { TeamForm } from "@/domain/history";
import { TeamId } from "@/domain/ids";
import { makeCtx, ml1x2Snapshot, ouGoalsSnapshot, bttsSnapshot } from "@/test/builders/makeCtx";
import { runBondedAnalysis } from "../pipeline";

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

const traceEntry = (
  plays: ReturnType<typeof runBondedAnalysis>["candidates"],
  side: string,
  ruleId: string,
) => {
  const play = plays.find((p) => p.selection.side === side);
  return play?.trace.find((e) => e.id === ruleId);
};

// â”€â”€â”€ xpoints-regression â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("xpoints-regression rule", () => {
  it("fires AGAINST home when home over-performs by â‰¥2.5 pts", () => {
    // home actual 15 pts vs 9 xPts â†’ +6 â†’ fade home
    const ctx = makeCtx({
      lines: { ML_1X2: ml1x2Snapshot(2.2, 3.4, 3.2) },
      homeForm: makeForm("home", { pointsLast: 15, xPointsLast: 9, lastN: 6 }),
      awayForm: makeForm("away"),
    });
    const { candidates: plays } = runBondedAnalysis(ctx, { includePass: true });
    const entry = traceEntry(plays, "home", "xpoints-regression");
    expect(entry?.verdict).toBe("AGAINST");
  });

  it("fires SUPPORT for home when home under-performs by â‰¥2.5 pts", () => {
    // home actual 6 pts vs 12 xPts â†’ -6 â†’ back home
    const ctx = makeCtx({
      lines: { ML_1X2: ml1x2Snapshot(2.2, 3.4, 3.2) },
      homeForm: makeForm("home", { pointsLast: 6, xPointsLast: 12, lastN: 6 }),
      awayForm: makeForm("away"),
    });
    const { candidates: plays } = runBondedAnalysis(ctx, { includePass: true });
    const entry = traceEntry(plays, "home", "xpoints-regression");
    expect(entry?.verdict).toBe("SUPPORT");
  });

  it("fires AGAINST away when away over-performs by â‰¥2.5 pts", () => {
    const ctx = makeCtx({
      lines: { ML_1X2: ml1x2Snapshot(2.2, 3.4, 3.2) },
      homeForm: makeForm("home"),
      awayForm: makeForm("away", { pointsLast: 15, xPointsLast: 9, lastN: 6 }),
    });
    const { candidates: plays } = runBondedAnalysis(ctx, { includePass: true });
    const entry = traceEntry(plays, "away", "xpoints-regression");
    expect(entry?.verdict).toBe("AGAINST");
  });

  it("fires SUPPORT for away when away under-performs by â‰¥2.5 pts", () => {
    const ctx = makeCtx({
      lines: { ML_1X2: ml1x2Snapshot(2.2, 3.4, 3.2) },
      homeForm: makeForm("home"),
      awayForm: makeForm("away", { pointsLast: 6, xPointsLast: 12, lastN: 6 }),
    });
    const { candidates: plays } = runBondedAnalysis(ctx, { includePass: true });
    const entry = traceEntry(plays, "away", "xpoints-regression");
    expect(entry?.verdict).toBe("SUPPORT");
  });

  it("does not fire when delta is below 2.5", () => {
    const ctx = makeCtx({
      lines: { ML_1X2: ml1x2Snapshot(2.2, 3.4, 3.2) },
      homeForm: makeForm("home", { pointsLast: 11, xPointsLast: 9, lastN: 6 }),
      awayForm: makeForm("away"),
    });
    const { candidates: plays } = runBondedAnalysis(ctx, { includePass: true });
    for (const p of plays) {
      expect(p.trace.find((e) => e.id === "xpoints-regression")).toBeUndefined();
    }
  });

  it("does not fire when xPointsLast is missing", () => {
    const ctx = makeCtx({
      lines: { ML_1X2: ml1x2Snapshot(2.2, 3.4, 3.2) },
      homeForm: makeForm("home", { pointsLast: 15, lastN: 6 }),
      awayForm: makeForm("away"),
    });
    const { candidates: plays } = runBondedAnalysis(ctx, { includePass: true });
    for (const p of plays) {
      expect(p.trace.find((e) => e.id === "xpoints-regression")).toBeUndefined();
    }
  });

  it("does not fire for draw selection", () => {
    const ctx = makeCtx({
      lines: { ML_1X2: ml1x2Snapshot(2.2, 3.4, 3.2) },
      homeForm: makeForm("home", { pointsLast: 15, xPointsLast: 9, lastN: 6 }),
      awayForm: makeForm("away"),
    });
    const { candidates: plays } = runBondedAnalysis(ctx, { includePass: true });
    const draw = plays.find((p) => p.selection.side === "draw");
    expect(draw?.trace.find((e) => e.id === "xpoints-regression")).toBeUndefined();
  });
});

// â”€â”€â”€ xg-matchup-asymmetry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("xg-matchup-asymmetry rule", () => {
  const highAttackForm = (teamId: string, xGFor: number, xGAgainst: number): TeamForm =>
    makeForm(teamId, {
      xGForLast: xGFor * 6,
      xGAgainstLast: xGAgainst * 6,
      lastN: 6,
    });

  it("fires SUPPORT for over when offensive mismatch detected", () => {
    // home attacks well (xGFor/g = 1.9) vs away leaky (xGAgainst/g = 1.6)
    const ctx = makeCtx({
      lines: { OU_GOALS: ouGoalsSnapshot(2.5, 1.85, 1.95) },
      homeForm: highAttackForm("home", 1.9, 1.1),
      awayForm: highAttackForm("away", 1.2, 1.6),
    });
    const { candidates: plays } = runBondedAnalysis(ctx, { includePass: true });
    const entry = traceEntry(plays, "over", "xg-matchup-asymmetry");
    expect(entry?.verdict).toBe("SUPPORT");
  });

  it("fires AGAINST under when offensive mismatch detected", () => {
    const ctx = makeCtx({
      lines: { OU_GOALS: ouGoalsSnapshot(2.5, 1.85, 1.95) },
      homeForm: highAttackForm("home", 1.9, 1.1),
      awayForm: highAttackForm("away", 1.2, 1.6),
    });
    const { candidates: plays } = runBondedAnalysis(ctx, { includePass: true });
    const entry = traceEntry(plays, "under", "xg-matchup-asymmetry");
    expect(entry?.verdict).toBe("AGAINST");
  });

  it("fires SUPPORT for BTTS yes when offensive mismatch detected", () => {
    const ctx = makeCtx({
      lines: { BTTS: bttsSnapshot(1.75, 2.0) },
      homeForm: highAttackForm("home", 1.9, 1.1),
      awayForm: highAttackForm("away", 1.2, 1.6),
    });
    const { candidates: plays } = runBondedAnalysis(ctx, { includePass: true });
    const entry = traceEntry(plays, "yes", "xg-matchup-asymmetry");
    expect(entry?.verdict).toBe("SUPPORT");
  });

  it("fires SUPPORT for under when defensive mismatch detected", () => {
    // both teams attack-weak and defensively solid
    const ctx = makeCtx({
      lines: { OU_GOALS: ouGoalsSnapshot(2.5, 2.1, 1.75) },
      homeForm: highAttackForm("home", 0.8, 0.7),
      awayForm: highAttackForm("away", 0.9, 0.8),
    });
    const { candidates: plays } = runBondedAnalysis(ctx, { includePass: true });
    const entry = traceEntry(plays, "under", "xg-matchup-asymmetry");
    expect(entry?.verdict).toBe("SUPPORT");
  });

  it("does not fire when xG data is missing", () => {
    const ctx = makeCtx({
      lines: { OU_GOALS: ouGoalsSnapshot(2.5, 1.85, 1.95) },
      homeForm: makeForm("home"),
      awayForm: makeForm("away"),
    });
    const { candidates: plays } = runBondedAnalysis(ctx, { includePass: true });
    for (const p of plays) {
      expect(p.trace.find((e) => e.id === "xg-matchup-asymmetry")).toBeUndefined();
    }
  });

  it("does not fire when xG values are in the neutral zone", () => {
    // xGFor/g â‰ˆ 1.3, xGAgainst/g â‰ˆ 1.1 â€” below both thresholds
    const ctx = makeCtx({
      lines: { OU_GOALS: ouGoalsSnapshot(2.5, 1.9, 1.9) },
      homeForm: highAttackForm("home", 1.3, 1.1),
      awayForm: highAttackForm("away", 1.3, 1.2),
    });
    const { candidates: plays } = runBondedAnalysis(ctx, { includePass: true });
    for (const p of plays) {
      expect(p.trace.find((e) => e.id === "xg-matchup-asymmetry")).toBeUndefined();
    }
  });
});

