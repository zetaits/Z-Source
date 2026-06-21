import { describe, expect, it } from "vitest";
import type { Bet } from "@/domain/bet";
import type { PlayCandidate } from "@/domain/play";
import { BetId, BookId, LeagueId, MatchId, PlayId } from "@/domain/ids";
import {
  KELLY_READINESS_THRESHOLD,
  beatClose,
  clvSummary,
  lineMovedFavorably,
  modelBeatClose,
  parsePropSelectionKey,
  type PropLineSnapshot,
} from "./clvSummary";

// Minimal playSnapshot carrying just the model fairProb modelBeatClose reads.
const snapshotWithFair = (fairProb: number, line = 5.5, side = "over"): PlayCandidate =>
  ({
    id: PlayId("play-1"),
    matchId: MatchId("evt-1"),
    selection: { marketKey: "PITCHER_KS", side, line, player: "Rhett Lowder" },
    price: { decimal: 2.0 },
    edgePct: 0.05,
    fairProb,
    confidence: 0.6,
    stakeUnits: 1,
    verdict: "PLAY",
    trace: [],
    generatedAt: "2026-06-20T12:00:00.000Z",
  }) as unknown as PlayCandidate;

const mkBet = (over: Partial<Bet> = {}): Bet => ({
  id: BetId("b1"),
  placedAt: "2026-06-20T12:00:00.000Z",
  matchId: MatchId("evt-1"),
  leagueId: LeagueId("mlb"),
  marketKey: "PITCHER_KS",
  selection: {
    marketKey: "PITCHER_KS",
    side: "over",
    line: 5.5,
    player: "Rhett Lowder",
    propLabel: "Strikeouts O/U",
  },
  priceDecimal: 2.0,
  book: BookId("Bet365"),
  stakeUnits: 1,
  stakeMinor: 1000,
  status: "WON",
  ...over,
});

describe("lineMovedFavorably", () => {
  it("over: lower line by close is favourable", () => {
    const snaps: PropLineSnapshot[] = [
      { side: "over", line: 5.5, priceDecimal: 2.0 },
      { side: "over", line: 4.5, priceDecimal: 2.1 },
    ];
    expect(lineMovedFavorably(mkBet({ selection: { ...mkBet().selection, line: 5.5 } }), snaps)).toBe(true);
  });

  it("over: no lower line means no favourable move", () => {
    const snaps: PropLineSnapshot[] = [{ side: "over", line: 5.5, priceDecimal: 2.0 }];
    expect(lineMovedFavorably(mkBet(), snaps)).toBe(false);
  });

  it("under: higher line by close is favourable", () => {
    const bet = mkBet({ selection: { marketKey: "PITCHER_KS", side: "under", line: 5.5 } });
    const snaps: PropLineSnapshot[] = [
      { side: "under", line: 5.5, priceDecimal: 2.0 },
      { side: "under", line: 6.5, priceDecimal: 1.9 },
    ];
    expect(lineMovedFavorably(bet, snaps)).toBe(true);
  });

  it("returns null with no same-side snapshots", () => {
    expect(lineMovedFavorably(mkBet(), [])).toBeNull();
  });

  it("returns null when the bet has no line", () => {
    const bet = mkBet({ selection: { marketKey: "PITCHER_KS", side: "over" } });
    expect(lineMovedFavorably(bet, [{ side: "over", line: 4.5, priceDecimal: 2 }])).toBeNull();
  });
});

describe("beatClose", () => {
  it("positive odds CLV beats the close", () => {
    // priceDecimal 2.0 vs closing 1.8 -> positive CLV.
    const bet = mkBet({ closingPriceDecimal: 1.8 });
    expect(beatClose(bet)).toBe(true);
  });

  it("negative odds CLV without a favourable line move does not beat the close", () => {
    const bet = mkBet({ closingPriceDecimal: 2.2 });
    expect(beatClose(bet)).toBe(false);
  });

  it("favourable line move beats the close even when odds CLV is unknown", () => {
    const bet = mkBet({ closingPriceDecimal: undefined });
    const snaps: PropLineSnapshot[] = [{ side: "over", line: 4.5, priceDecimal: 2.1 }];
    expect(beatClose(bet, snaps)).toBe(true);
  });

  it("returns null when neither dimension is measurable", () => {
    const bet = mkBet({ closingPriceDecimal: undefined });
    expect(beatClose(bet, [])).toBeNull();
  });
});

describe("parsePropSelectionKey", () => {
  it("parses a prop O/U selectionKey", () => {
    expect(parsePropSelectionKey("PITCHER_KS:over@5.5|Rhett Lowder")).toEqual({
      side: "over",
      line: 5.5,
      player: "Rhett Lowder",
    });
  });

  it("returns null for football keys (no player, no line)", () => {
    expect(parsePropSelectionKey("ML_1X2:home")).toBeNull();
    expect(parsePropSelectionKey("OU_GOALS:over@2.5")).toBeNull();
  });
});

describe("player filtering", () => {
  it("ignores snapshots for a different pitcher", () => {
    const bet = mkBet({
      selection: { marketKey: "PITCHER_KS", side: "over", line: 5.5, player: "Rhett Lowder" },
    });
    const otherPitcher: PropLineSnapshot[] = [
      { side: "over", line: 4.5, priceDecimal: 2.1, player: "Some Other Guy" },
    ];
    // Only an opposing pitcher's lower line exists -> no favourable move for ours.
    expect(lineMovedFavorably(bet, otherPitcher)).toBeNull();
  });
});

describe("modelBeatClose", () => {
  // Closing snapshots: de-vig over@2.5 / under@1.6 -> impOver=.4, impUnder=.625,
  // closeFairOver = .4/1.025 ≈ 0.39. Model fair 0.55 > 0.39 -> model beat close.
  const closeSnaps: PropLineSnapshot[] = [
    { side: "over", line: 5.5, priceDecimal: 2.5 },
    { side: "under", line: 5.5, priceDecimal: 1.6 },
  ];

  it("model fair prob above closing no-vig prob beats the close (over)", () => {
    const bet = mkBet({ playSnapshot: snapshotWithFair(0.55) });
    expect(modelBeatClose(bet, closeSnaps)).toBe(true);
  });

  it("model fair prob below closing no-vig prob does not beat the close (over)", () => {
    const bet = mkBet({ playSnapshot: snapshotWithFair(0.2) });
    expect(modelBeatClose(bet, closeSnaps)).toBe(false);
  });

  it("evaluates the bet SIDE (under)", () => {
    // closeFairUnder = 1 - 0.39 ≈ 0.61. Model under-side fair 0.7 > 0.61 -> true.
    const bet = mkBet({
      selection: { marketKey: "PITCHER_KS", side: "under", line: 5.5 },
      playSnapshot: snapshotWithFair(0.7, 5.5, "under"),
    });
    expect(modelBeatClose(bet, closeSnaps)).toBe(true);
  });

  it("returns null when only one closing side is captured", () => {
    const bet = mkBet({ playSnapshot: snapshotWithFair(0.55) });
    expect(modelBeatClose(bet, [{ side: "over", line: 5.5, priceDecimal: 2.5 }])).toBeNull();
  });

  it("returns null when the bet has no model snapshot", () => {
    expect(modelBeatClose(mkBet({ playSnapshot: undefined }), closeSnaps)).toBeNull();
  });

  it("uses the LATEST snapshot per side at the bet line", () => {
    const snaps: PropLineSnapshot[] = [
      { side: "over", line: 5.5, priceDecimal: 1.5 }, // early
      { side: "under", line: 5.5, priceDecimal: 1.5 },
      { side: "over", line: 5.5, priceDecimal: 2.5 }, // latest -> used
      { side: "under", line: 5.5, priceDecimal: 1.6 },
    ];
    const bet = mkBet({ playSnapshot: snapshotWithFair(0.55) });
    expect(modelBeatClose(bet, snaps)).toBe(true);
  });
});

describe("beatClose with the model axis", () => {
  it("model beating the close counts even when odds CLV is unknown", () => {
    const bet = mkBet({ closingPriceDecimal: undefined, playSnapshot: snapshotWithFair(0.55) });
    const snaps: PropLineSnapshot[] = [
      { side: "over", line: 5.5, priceDecimal: 2.5 },
      { side: "under", line: 5.5, priceDecimal: 1.6 },
    ];
    expect(beatClose(bet, snaps)).toBe(true);
  });
});

describe("clvSummary", () => {
  it("ignores non-prop (football) bets", () => {
    const football = mkBet({
      id: BetId("f1"),
      marketKey: "ML_1X2",
      selection: { marketKey: "ML_1X2", side: "home" },
      closingPriceDecimal: 1.5,
    });
    const prop = mkBet({ id: BetId("p1"), closingPriceDecimal: 1.8 });
    const s = clvSummary([football, prop]);
    expect(s.nPlays).toBe(1);
  });

  it("aggregates odds CLV and beat-close over measurable plays", () => {
    const winner = mkBet({ id: BetId("p1"), priceDecimal: 2.0, closingPriceDecimal: 1.6 }); // +25%
    const loser = mkBet({ id: BetId("p2"), priceDecimal: 2.0, closingPriceDecimal: 2.5 }); // -20%
    const pending = mkBet({ id: BetId("p3"), closingPriceDecimal: undefined }); // not measurable
    const s = clvSummary([winner, loser, pending]);
    expect(s.nPlays).toBe(3);
    expect(s.nWithClose).toBe(2);
    expect(s.pctBeatClose).toBeCloseTo(0.5);
    expect(s.avgClvPct).toBeCloseTo((0.25 + -0.2) / 2);
  });

  it("counts a favourable line move toward beat-close when odds are pending", () => {
    const bet = mkBet({ id: BetId("p1"), closingPriceDecimal: undefined });
    const s = clvSummary([bet], {
      p1: [{ side: "over", line: 4.5, priceDecimal: 2.1 }],
    });
    expect(s.nWithClose).toBe(1);
    expect(s.pctBeatClose).toBe(1);
  });

  it("flags kelly readiness at the threshold", () => {
    const few = Array.from({ length: 5 }, (_, i) => mkBet({ id: BetId(`p${i}`) }));
    expect(clvSummary(few).kellyReady).toBe(false);
    const many = Array.from({ length: KELLY_READINESS_THRESHOLD }, (_, i) =>
      mkBet({ id: BetId(`p${i}`) }),
    );
    expect(clvSummary(many).kellyReady).toBe(true);
  });

  it("returns zeros for an empty bet list", () => {
    const s = clvSummary([]);
    expect(s).toEqual({
      nPlays: 0,
      nWithClose: 0,
      pctBeatClose: 0,
      avgClvPct: 0,
      kellyReady: false,
    });
  });
});
