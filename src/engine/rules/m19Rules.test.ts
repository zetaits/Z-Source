import { describe, expect, it } from "vitest";
import type { H2H, Intangibles, TeamForm, TeamFormGame } from "@/domain/history";
import { MatchId, TeamId } from "@/domain/ids";
import { makeCtx, ouGoalsSnapshot, bttsSnapshot } from "@/test/builders/makeCtx";
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

const makeMeeting = (
  i: number,
  goalsFor: number,
  goalsAgainst: number,
): TeamFormGame => ({
  matchId: MatchId(`h2h-${i}`),
  date: "2025-01-01",
  opponentId: TeamId("away"),
  opponentName: "Away CF",
  isHome: true,
  goalsFor,
  goalsAgainst,
  result: goalsFor > goalsAgainst ? "W" : goalsFor < goalsAgainst ? "L" : "D",
});

const makeH2HFromScores = (scores: Array<[number, number]>): H2H => {
  const meetings = scores.map(([gf, ga], i) => makeMeeting(i, gf, ga));
  const homeWins = meetings.filter((m) => m.goalsFor > m.goalsAgainst).length;
  const awayWins = meetings.filter((m) => m.goalsFor < m.goalsAgainst).length;
  const draws = meetings.filter((m) => m.goalsFor === m.goalsAgainst).length;
  const avg =
    meetings.reduce((s, m) => s + m.goalsFor + m.goalsAgainst, 0) / meetings.length;
  return {
    homeId: TeamId("home"),
    awayId: TeamId("away"),
    meetings,
    homeWins,
    awayWins,
    draws,
    averageGoals: avg,
  };
};

const makeIntangibles = (
  homeRestDays?: number,
  awayRestDays?: number,
): Intangibles => ({
  matchId: MatchId("match-1"),
  homeRestDays,
  awayRestDays,
  homeInjuries: [],
  awayInjuries: [],
});

const traceEntry = (
  plays: ReturnType<typeof runBondedAnalysis>["candidates"],
  side: string,
  ruleId: string,
  marketKey?: string,
) => {
  const play = plays.find(
    (p) =>
      p.selection.side === side &&
      (marketKey === undefined || p.selection.marketKey === marketKey),
  );
  return play?.trace.find((e) => e.id === ruleId);
};

describe("btts-xg-poisson rule", () => {
  it("supports BTTS yes when both teams have high xG", () => {
    const ctx = makeCtx({
      lines: { BTTS: bttsSnapshot(2.5, 1.55) },
      homeForm: makeForm("home", { xGForLast: 10.8, xGAgainstLast: 6, lastN: 6 }),
      awayForm: makeForm("away", { xGForLast: 9.6, xGAgainstLast: 7.2, lastN: 6 }),
    });
    const { candidates: plays } = runBondedAnalysis(ctx, { includePass: true });
    const entry = traceEntry(plays, "yes", "btts-xg-poisson", "BTTS");
    expect(entry?.verdict).toBe("SUPPORT");
  });

  it("supports BTTS no when both teams have low xG", () => {
    const ctx = makeCtx({
      lines: { BTTS: bttsSnapshot(1.55, 2.5) },
      homeForm: makeForm("home", { xGForLast: 2.4, xGAgainstLast: 6, lastN: 6 }),
      awayForm: makeForm("away", { xGForLast: 3.0, xGAgainstLast: 5, lastN: 6 }),
    });
    const { candidates: plays } = runBondedAnalysis(ctx, { includePass: true });
    const entry = traceEntry(plays, "no", "btts-xg-poisson", "BTTS");
    expect(entry?.verdict).toBe("SUPPORT");
  });

  it("supports OU_GOALS over when Poisson total exceeds line", () => {
    const ctx = makeCtx({
      lines: { OU_GOALS: ouGoalsSnapshot(2.5, 1.85, 1.95) },
      homeForm: makeForm("home", { xGForLast: 12, xGAgainstLast: 7, lastN: 6 }),
      awayForm: makeForm("away", { xGForLast: 10.8, xGAgainstLast: 7, lastN: 6 }),
    });
    const { candidates: plays } = runBondedAnalysis(ctx, { includePass: true });
    const entry = traceEntry(plays, "over", "btts-xg-poisson", "OU_GOALS");
    expect(entry?.verdict).toBe("SUPPORT");
  });

  it("does not fire when xG data missing", () => {
    const ctx = makeCtx({
      lines: { BTTS: bttsSnapshot(1.9, 1.9) },
      homeForm: makeForm("home"),
      awayForm: makeForm("away"),
    });
    const { candidates: plays } = runBondedAnalysis(ctx, { includePass: true });
    for (const p of plays) {
      expect(p.trace.find((e) => e.id === "btts-xg-poisson")).toBeUndefined();
    }
  });

  it("emits data.rho with DC correlation parameter", () => {
    const ctx = makeCtx({
      lines: { BTTS: bttsSnapshot(2.5, 1.55) },
      homeForm: makeForm("home", { xGForLast: 10.8, xGAgainstLast: 6, lastN: 6 }),
      awayForm: makeForm("away", { xGForLast: 9.6, xGAgainstLast: 7.2, lastN: 6 }),
    });
    const { candidates: plays } = runBondedAnalysis(ctx, { includePass: true });
    const entry = traceEntry(plays, "yes", "btts-xg-poisson", "BTTS");
    expect(entry?.data?.rho).toBe(0.13);
  });

  it("does not fire when model and market agree (delta below threshold)", () => {
    // λH=λA≈1.23 → P(BTTS)=(1-e^-1.23)²≈0.500 ≈ vig-free baseProb 0.5
    const ctx = makeCtx({
      lines: { BTTS: bttsSnapshot(1.9, 1.9) },
      homeForm: makeForm("home", { xGForLast: 7.38, xGAgainstLast: 7.38, lastN: 6 }),
      awayForm: makeForm("away", { xGForLast: 7.38, xGAgainstLast: 7.38, lastN: 6 }),
    });
    const { candidates: plays } = runBondedAnalysis(ctx, { includePass: true });
    for (const p of plays) {
      expect(p.trace.find((e) => e.id === "btts-xg-poisson")).toBeUndefined();
    }
  });
});

describe("goals-tempo-form rule", () => {
  it("supports OU over when combined tempo exceeds line", () => {
    const ctx = makeCtx({
      lines: { OU_GOALS: ouGoalsSnapshot(2.5, 1.95, 1.85) },
      homeForm: makeForm("home", { goalsFor: 16, goalsAgainst: 8, lastN: 6 }),
      awayForm: makeForm("away", { goalsFor: 14, goalsAgainst: 10, lastN: 6 }),
    });
    const { candidates: plays } = runBondedAnalysis(ctx, { includePass: true });
    const entry = traceEntry(plays, "over", "goals-tempo-form", "OU_GOALS");
    expect(entry?.verdict).toBe("SUPPORT");
  });

  it("supports OU under when combined tempo below line", () => {
    const ctx = makeCtx({
      lines: { OU_GOALS: ouGoalsSnapshot(2.5, 1.95, 1.85) },
      homeForm: makeForm("home", { goalsFor: 5, goalsAgainst: 4, lastN: 6 }),
      awayForm: makeForm("away", { goalsFor: 4, goalsAgainst: 5, lastN: 6 }),
    });
    const { candidates: plays } = runBondedAnalysis(ctx, { includePass: true });
    const entry = traceEntry(plays, "under", "goals-tempo-form", "OU_GOALS");
    expect(entry?.verdict).toBe("SUPPORT");
  });

  it("supports BTTS yes when tempo above baseline", () => {
    const ctx = makeCtx({
      lines: { BTTS: bttsSnapshot(1.7, 2.15) },
      homeForm: makeForm("home", { goalsFor: 16, goalsAgainst: 10, lastN: 6 }),
      awayForm: makeForm("away", { goalsFor: 14, goalsAgainst: 12, lastN: 6 }),
    });
    const { candidates: plays } = runBondedAnalysis(ctx, { includePass: true });
    const entry = traceEntry(plays, "yes", "goals-tempo-form", "BTTS");
    expect(entry?.verdict).toBe("SUPPORT");
  });

  it("does not fire when tempo close to baseline", () => {
    const ctx = makeCtx({
      lines: { BTTS: bttsSnapshot(1.9, 1.9) },
      homeForm: makeForm("home", { goalsFor: 8, goalsAgainst: 8, lastN: 6 }),
      awayForm: makeForm("away", { goalsFor: 7, goalsAgainst: 8, lastN: 6 }),
    });
    const { candidates: plays } = runBondedAnalysis(ctx, { includePass: true });
    for (const p of plays) {
      expect(p.trace.find((e) => e.id === "goals-tempo-form")).toBeUndefined();
    }
  });
});

describe("rest-congestion fatigue mode", () => {
  it("supports OU under when at least one club has rest below threshold", () => {
    const ctx = makeCtx({
      lines: { OU_GOALS: ouGoalsSnapshot(2.5, 1.95, 1.85) },
      intangibles: makeIntangibles(2, 5),
    });
    const { candidates: plays } = runBondedAnalysis(ctx, { includePass: true });
    const entry = traceEntry(plays, "under", "rest-congestion", "OU_GOALS");
    expect(entry?.verdict).toBe("SUPPORT");
    expect(entry?.data?.mode).toBe("fatigue");
  });

  it("supports BTTS no when fatigue present", () => {
    const ctx = makeCtx({
      lines: { BTTS: bttsSnapshot(1.9, 1.9) },
      intangibles: makeIntangibles(2, 4),
    });
    const { candidates: plays } = runBondedAnalysis(ctx, { includePass: true });
    const entry = traceEntry(plays, "no", "rest-congestion", "BTTS");
    expect(entry?.verdict).toBe("SUPPORT");
  });

  it("does not fire on OU/BTTS when both clubs rested", () => {
    const ctx = makeCtx({
      lines: { OU_GOALS: ouGoalsSnapshot(2.5, 1.95, 1.85) },
      intangibles: makeIntangibles(6, 5),
    });
    const { candidates: plays } = runBondedAnalysis(ctx, { includePass: true });
    for (const p of plays) {
      expect(p.trace.find((e) => e.id === "rest-congestion")).toBeUndefined();
    }
  });
});

describe("h2h-dominance OU/BTTS pattern mode", () => {
  it("supports OU over when ≥80% H2H meetings went Over the line", () => {
    const ctx = makeCtx({
      lines: { OU_GOALS: ouGoalsSnapshot(2.5, 1.95, 1.85) },
      h2h: makeH2HFromScores([
        [3, 2],
        [2, 2],
        [4, 1],
        [3, 1],
        [2, 3],
      ]),
    });
    const { candidates: plays } = runBondedAnalysis(ctx, { includePass: true });
    const entry = traceEntry(plays, "over", "h2h-dominance", "OU_GOALS");
    expect(entry?.verdict).toBe("SUPPORT");
    expect(entry?.data?.pattern).toBe("goals");
  });

  it("supports BTTS yes when ≥80% H2H meetings had BTTS", () => {
    const ctx = makeCtx({
      lines: { BTTS: bttsSnapshot(1.9, 1.9) },
      h2h: makeH2HFromScores([
        [2, 1],
        [3, 2],
        [1, 1],
        [2, 3],
        [1, 2],
      ]),
    });
    const { candidates: plays } = runBondedAnalysis(ctx, { includePass: true });
    const entry = traceEntry(plays, "yes", "h2h-dominance", "BTTS");
    expect(entry?.verdict).toBe("SUPPORT");
    expect(entry?.data?.pattern).toBe("btts");
  });

  it("supports BTTS no when ≤20% H2H had BTTS", () => {
    const ctx = makeCtx({
      lines: { BTTS: bttsSnapshot(1.9, 1.9) },
      h2h: makeH2HFromScores([
        [1, 0],
        [2, 0],
        [0, 1],
        [3, 0],
        [0, 0],
      ]),
    });
    const { candidates: plays } = runBondedAnalysis(ctx, { includePass: true });
    const entry = traceEntry(plays, "no", "h2h-dominance", "BTTS");
    expect(entry?.verdict).toBe("SUPPORT");
  });

  it("does not fire on OU/BTTS when pattern not consistent", () => {
    const ctx = makeCtx({
      lines: { OU_GOALS: ouGoalsSnapshot(2.5, 1.95, 1.85) },
      h2h: makeH2HFromScores([
        [1, 1],
        [3, 2],
        [0, 1],
        [2, 2],
        [1, 0],
      ]),
    });
    const { candidates: plays } = runBondedAnalysis(ctx, { includePass: true });
    for (const p of plays) {
      expect(p.trace.find((e) => e.id === "h2h-dominance")).toBeUndefined();
    }
  });
});
