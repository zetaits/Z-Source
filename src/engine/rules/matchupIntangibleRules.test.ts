import { describe, expect, it } from "vitest";
import type { H2H, Intangibles, TeamForm } from "@/domain/history";
import { MatchId, TeamId } from "@/domain/ids";
import { makeCtx, ml1x2Snapshot } from "@/test/builders/makeCtx";
import { runBondedAnalysis } from "../pipeline";

const makeForm = (teamId: string, ppgLast: number, lastN = 6): TeamForm => ({
  teamId: TeamId(teamId),
  lastN,
  games: [],
  goalsFor: 0,
  goalsAgainst: 0,
  cleanSheets: 0,
  bttsRate: 0,
  ppgLast,
});

const makeH2H = (homeWins: number, draws: number, awayWins: number): H2H => ({
  homeId: TeamId("home"),
  awayId: TeamId("away"),
  meetings: new Array(homeWins + draws + awayWins).fill(null).map((_, i) => ({
    matchId: MatchId(`h2h-${i}`),
    date: "2025-01-01",
    opponentId: TeamId("away"),
    opponentName: "Away CF",
    isHome: true,
    goalsFor: 0,
    goalsAgainst: 0,
    result: "D",
  })),
  homeWins,
  awayWins,
  draws,
  averageGoals: 2.5,
});

const makeIntangibles = (homeRestDays?: number, awayRestDays?: number): Intangibles => ({
  matchId: MatchId("match-1"),
  homeRestDays,
  awayRestDays,
  homeInjuries: [],
  awayInjuries: [],
});

describe("form-divergence rule", () => {
  it("fires SUPPORT for the in-form home side when PPG gap ≥ 0.5", () => {
    const ctx = makeCtx({
      lines: { ML_1X2: ml1x2Snapshot(2.2, 3.4, 3.2) },
      homeForm: makeForm("home", 2.4),
      awayForm: makeForm("away", 1.0),
    });
    const plays = runBondedAnalysis(ctx, { includePass: true });
    const home = plays.find((p) => p.selection.side === "home");
    const entry = home?.trace.find((e) => e.id === "form-divergence");
    expect(entry?.verdict).toBe("SUPPORT");
  });

  it("does not fire when PPG gap is below threshold", () => {
    const ctx = makeCtx({
      lines: { ML_1X2: ml1x2Snapshot(2.2, 3.4, 3.2) },
      homeForm: makeForm("home", 1.8),
      awayForm: makeForm("away", 1.5),
    });
    const plays = runBondedAnalysis(ctx, { includePass: true });
    for (const p of plays) {
      expect(p.trace.find((e) => e.id === "form-divergence")).toBeUndefined();
    }
  });

  it("skips when forms are missing", () => {
    const ctx = makeCtx({
      lines: { ML_1X2: ml1x2Snapshot(2.2, 3.4, 3.2) },
    });
    const plays = runBondedAnalysis(ctx, { includePass: true });
    for (const p of plays) {
      expect(p.trace.find((e) => e.id === "form-divergence")).toBeUndefined();
    }
  });
});

describe("h2h-dominance rule", () => {
  it("fires SUPPORT for dominant home side with ≥4 meetings and ≥40pt gap", () => {
    const ctx = makeCtx({
      lines: { ML_1X2: ml1x2Snapshot(2.2, 3.4, 3.2) },
      h2h: makeH2H(4, 1, 0),
    });
    const plays = runBondedAnalysis(ctx, { includePass: true });
    const home = plays.find((p) => p.selection.side === "home");
    const entry = home?.trace.find((e) => e.id === "h2h-dominance");
    expect(entry?.verdict).toBe("SUPPORT");
  });

  it("does not fire with fewer than 4 meetings", () => {
    const ctx = makeCtx({
      lines: { ML_1X2: ml1x2Snapshot(2.2, 3.4, 3.2) },
      h2h: makeH2H(2, 0, 0),
    });
    const plays = runBondedAnalysis(ctx, { includePass: true });
    for (const p of plays) {
      expect(p.trace.find((e) => e.id === "h2h-dominance")).toBeUndefined();
    }
  });

  it("does not fire when record is balanced", () => {
    const ctx = makeCtx({
      lines: { ML_1X2: ml1x2Snapshot(2.2, 3.4, 3.2) },
      h2h: makeH2H(2, 2, 2),
    });
    const plays = runBondedAnalysis(ctx, { includePass: true });
    for (const p of plays) {
      expect(p.trace.find((e) => e.id === "h2h-dominance")).toBeUndefined();
    }
  });
});

describe("rest-congestion rule", () => {
  it("fires SUPPORT for the fresher home side when rest delta ≥ 2 days", () => {
    const ctx = makeCtx({
      lines: { ML_1X2: ml1x2Snapshot(2.2, 3.4, 3.2) },
      intangibles: makeIntangibles(6, 3),
    });
    const plays = runBondedAnalysis(ctx, { includePass: true });
    const home = plays.find((p) => p.selection.side === "home");
    const entry = home?.trace.find((e) => e.id === "rest-congestion");
    expect(entry?.verdict).toBe("SUPPORT");
  });

  it("does not fire when rest differential is below threshold", () => {
    const ctx = makeCtx({
      lines: { ML_1X2: ml1x2Snapshot(2.2, 3.4, 3.2) },
      intangibles: makeIntangibles(4, 3),
    });
    const plays = runBondedAnalysis(ctx, { includePass: true });
    for (const p of plays) {
      expect(p.trace.find((e) => e.id === "rest-congestion")).toBeUndefined();
    }
  });

  it("skips when rest data is missing", () => {
    const ctx = makeCtx({
      lines: { ML_1X2: ml1x2Snapshot(2.2, 3.4, 3.2) },
      intangibles: makeIntangibles(undefined, undefined),
    });
    const plays = runBondedAnalysis(ctx, { includePass: true });
    for (const p of plays) {
      expect(p.trace.find((e) => e.id === "rest-congestion")).toBeUndefined();
    }
  });
});
