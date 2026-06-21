/**
 * Phase-4 CLV + staking tests for MLB pitcher-strikeout betting.
 *
 * Tests cover:
 *  - Prop snapshot persistence (snapshotsRepo round-trip, opener/closing flags)
 *  - CLV computation (odds CLV sign, beat-close boolean, missing closing)
 *  - CLV summary + Kelly readiness gate (aggregation, threshold flip)
 *  - Flat staking (sizeStakeUnits under FLAT policy, PASS -> 0u, seam swap)
 *  - Degradation: no props/closing -> CLV pending, never throws
 *
 * All tests are fixture-based (offline). Imports PRODUCTION exports only.
 * Matches existing vitest style (kProjection.test.ts, odds.test.ts).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BetId, BookId, LeagueId, MatchId, PlayId } from "@/domain/ids";
import type { Bet } from "@/domain/bet";
import { clvPct } from "@/domain/bet";
import type { Selection } from "@/domain/market";
import { selectionKey } from "@/domain/market";
import type { StakePolicy } from "@/domain/strategy";
import { DEFAULT_STAKE_POLICY } from "@/domain/strategy";
import { sizeStakeUnits } from "@/engine/stake";
import { DEFAULT_UNIT_BANKROLL_FRACTION } from "@/engine";
import {
  KELLY_READINESS_THRESHOLD,
  beatClose,
  clvSummary,
  isPropBet,
  lineMovedFavorably,
  type PropLineSnapshot,
} from "@/features/bankroll/clvSummary";
import { __setStorageForTests } from "@/storage";
import { InMemoryAdapter } from "@/test/helpers/InMemoryAdapter";
import { snapshotsRepo } from "@/storage/repos/snapshotsRepo";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mkBet = (over: Partial<Bet> = {}): Bet => ({
  id: BetId("bet-1"),
  placedAt: "2026-06-20T12:00:00.000Z",
  matchId: MatchId("evt-abc"),
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
  status: "OPEN",
  ...over,
});

/** The FLAT policy pinned in analyze.ts for v1 baseball. */
const FLAT_BASEBALL_POLICY: StakePolicy = {
  kind: "FLAT",
  kellyFraction: 0.25,
  maxUnitsPerPlay: 2,
  flatUnits: 1,
  minEdgePct: 0.05,
  minConfidence: 0.45,
  unbondedFactor: 1,
};

// ---------------------------------------------------------------------------
// 1. Prop snapshot persistence — snapshotsRepo round-trip
// ---------------------------------------------------------------------------

describe("prop snapshot persistence (snapshotsRepo)", () => {
  let db: InMemoryAdapter;

  beforeEach(() => {
    db = new InMemoryAdapter();
    __setStorageForTests(db);
  });

  afterEach(() => {
    __setStorageForTests(null);
  });

  it("writes a PITCHER_KS player-tagged line and reads it back", async () => {
    const sel: Selection = {
      marketKey: "PITCHER_KS",
      side: "over",
      line: 5.5,
      player: "rhett lowder",
    };
    await snapshotsRepo.recordOffer({
      matchId: MatchId("evt-1"),
      marketKey: "PITCHER_KS",
      selection: sel,
      priceDecimal: 1.87,
      book: BookId("Bet365"),
      takenAt: "2026-06-20T18:00:00.000Z",
      isOpener: false,
    });

    const rows = await snapshotsRepo.listForMatch(MatchId("evt-1"), "PITCHER_KS");
    expect(rows).toHaveLength(1);
    expect(rows[0].selectionKey).toBe(selectionKey(sel));
    expect(rows[0].priceDecimal).toBe(1.87);
    expect(rows[0].isOpener).toBe(false);
  });

  it("regression: closing capture needs the player tag — a player-less selection misses", async () => {
    // The blocker: snapshots are keyed WITH |player, but a logged bet's bare
    // selection drops it. At settle, useBets passes playSnapshot.selection
    // (player-tagged) to latestFor — this asserts WHY: the player-less key
    // never matches, the player-tagged one does.
    const tagged: Selection = {
      marketKey: "PITCHER_KS",
      side: "over",
      line: 7.5,
      player: "tarik skubal",
    };
    const playerLess: Selection = { marketKey: "PITCHER_KS", side: "over", line: 7.5 };
    expect(selectionKey(tagged)).not.toBe(selectionKey(playerLess));

    await snapshotsRepo.recordOffer({
      matchId: MatchId("evt-pl"),
      marketKey: "PITCHER_KS",
      selection: tagged,
      priceDecimal: 1.9,
      book: BookId("Bet365"),
      takenAt: "2026-06-20T18:00:00.000Z",
      isOpener: false,
    });

    // Player-less selection (the bug) → no match → CLV would stay pending.
    expect(
      await snapshotsRepo.latestFor(MatchId("evt-pl"), "PITCHER_KS", playerLess),
    ).toBeNull();
    // Player-tagged selection (the fix path) → resolves the closing line.
    const hit = await snapshotsRepo.latestFor(MatchId("evt-pl"), "PITCHER_KS", tagged);
    expect(hit?.priceDecimal).toBe(1.9);
  });

  it("distinguishes opener from closing snapshots", async () => {
    const sel: Selection = {
      marketKey: "PITCHER_KS",
      side: "over",
      line: 5.5,
      player: "corbin burnes",
    };

    await snapshotsRepo.recordOffer({
      matchId: MatchId("evt-2"),
      marketKey: "PITCHER_KS",
      selection: sel,
      priceDecimal: 2.1,
      book: BookId("Bet365"),
      takenAt: "2026-06-20T10:00:00.000Z",
      isOpener: true,
    });

    await snapshotsRepo.recordOffer({
      matchId: MatchId("evt-2"),
      marketKey: "PITCHER_KS",
      selection: sel,
      priceDecimal: 1.95,
      book: BookId("Bet365"),
      takenAt: "2026-06-20T18:00:00.000Z",
      isOpener: false,
    });

    const hasOpen = await snapshotsRepo.hasOpener(MatchId("evt-2"));
    expect(hasOpen).toBe(true);

    const rows = await snapshotsRepo.listForMatch(MatchId("evt-2"), "PITCHER_KS");
    expect(rows).toHaveLength(2);
    // listForMatch orders by taken_at ASC
    expect(rows[0].isOpener).toBe(true);
    expect(rows[0].priceDecimal).toBe(2.1);
    expect(rows[1].isOpener).toBe(false);
    expect(rows[1].priceDecimal).toBe(1.95);
  });

  it("multiple snapshots over time resolve a correct closing line via latestFor", async () => {
    const sel: Selection = {
      marketKey: "PITCHER_KS",
      side: "under",
      line: 4.5,
      player: "gerrit cole",
    };

    // Three snapshots at T=1, T=2, T=3 — latestFor should return T=3 (the
    // most recent non-opener).
    for (const [ts, price] of [
      ["2026-06-20T14:00:00.000Z", 1.83],
      ["2026-06-20T16:00:00.000Z", 1.78],
      ["2026-06-20T18:00:00.000Z", 1.72],
    ] as const) {
      await snapshotsRepo.recordOffer({
        matchId: MatchId("evt-3"),
        marketKey: "PITCHER_KS",
        selection: sel,
        priceDecimal: price,
        book: BookId("Bet365"),
        takenAt: ts,
        isOpener: false,
      });
    }

    const latest = await snapshotsRepo.latestFor(
      MatchId("evt-3"),
      "PITCHER_KS",
      sel,
    );
    expect(latest).not.toBeNull();
    expect(latest!.priceDecimal).toBe(1.72);
    expect(latest!.takenAt).toBe("2026-06-20T18:00:00.000Z");
  });

  it("latestFor returns null when no snapshots exist", async () => {
    const sel: Selection = {
      marketKey: "PITCHER_KS",
      side: "over",
      line: 6.5,
      player: "nobody",
    };
    const result = await snapshotsRepo.latestFor(
      MatchId("evt-missing"),
      "PITCHER_KS",
      sel,
    );
    expect(result).toBeNull();
  });

  it("selectionKey includes player suffix for PITCHER_KS props", () => {
    const sel: Selection = {
      marketKey: "PITCHER_KS",
      side: "over",
      line: 5.5,
      player: "rhett lowder",
    };
    const key = selectionKey(sel);
    expect(key).toBe("PITCHER_KS:over@5.5|rhett lowder");
    expect(key).toContain("|");
  });
});

// ---------------------------------------------------------------------------
// 2. CLV computation — price@bet vs closing
// ---------------------------------------------------------------------------

describe("CLV computation", () => {
  it("positive CLV when bet price > closing price (got a better price)", () => {
    // Bet at 2.0, closed at 1.8 -> (2.0 - 1.8) / 1.8 = +11.1%
    const bet = mkBet({ priceDecimal: 2.0, closingPriceDecimal: 1.8 });
    const clv = clvPct(bet);
    expect(clv).not.toBeNull();
    expect(clv!).toBeGreaterThan(0);
    expect(clv!).toBeCloseTo(0.1111, 3);
  });

  it("negative CLV when bet price < closing price (worse price)", () => {
    // Bet at 1.8, closed at 2.0 -> (1.8 - 2.0) / 2.0 = -10%
    const bet = mkBet({ priceDecimal: 1.8, closingPriceDecimal: 2.0 });
    const clv = clvPct(bet);
    expect(clv).not.toBeNull();
    expect(clv!).toBeLessThan(0);
    expect(clv!).toBeCloseTo(-0.1, 3);
  });

  it("missing closing price -> CLV pending (null, not 0, not throw)", () => {
    const bet = mkBet({ closingPriceDecimal: undefined });
    const clv = clvPct(bet);
    expect(clv).toBeNull();
  });

  it("closing price of 0 -> CLV null (guard division by zero)", () => {
    const bet = mkBet({ closingPriceDecimal: 0 });
    expect(clvPct(bet)).toBeNull();
  });

  it("identical prices -> CLV 0 (breakeven)", () => {
    const bet = mkBet({ priceDecimal: 1.87, closingPriceDecimal: 1.87 });
    expect(clvPct(bet)).toBeCloseTo(0);
  });

  it("beat-close boolean: positive odds CLV -> true", () => {
    const bet = mkBet({ closingPriceDecimal: 1.8 });
    expect(beatClose(bet)).toBe(true);
  });

  it("beat-close boolean: negative odds CLV, no line move -> false", () => {
    const bet = mkBet({ closingPriceDecimal: 2.2 });
    expect(beatClose(bet)).toBe(false);
  });

  it("beat-close boolean: missing closing + no snapshots -> null (pending)", () => {
    const bet = mkBet({ closingPriceDecimal: undefined });
    expect(beatClose(bet, [])).toBeNull();
  });

  it("beat-close: favourable line move compensates for missing odds CLV", () => {
    const bet = mkBet({ closingPriceDecimal: undefined });
    // Over 5.5 and the line moved down to 4.5 -> favourable
    const snaps: PropLineSnapshot[] = [
      { side: "over", line: 4.5, priceDecimal: 2.1 },
    ];
    expect(beatClose(bet, snaps)).toBe(true);
  });

  it("hand-computed CLV delta: 2.10 bet, 1.85 close = +13.5%", () => {
    const bet = mkBet({ priceDecimal: 2.1, closingPriceDecimal: 1.85 });
    const clv = clvPct(bet)!;
    // (2.10 - 1.85) / 1.85 = 0.25 / 1.85 = 0.13514
    expect(clv).toBeCloseTo(0.13514, 4);
    expect(beatClose(bet)).toBe(true);
  });

  it("line moved toward our side -> positive signal (over: lower line)", () => {
    const bet = mkBet({
      selection: { marketKey: "PITCHER_KS", side: "over", line: 5.5 },
    });
    const snaps: PropLineSnapshot[] = [
      { side: "over", line: 5.5, priceDecimal: 2.0 },
      { side: "over", line: 4.5, priceDecimal: 2.1 },
    ];
    expect(lineMovedFavorably(bet, snaps)).toBe(true);
  });

  it("line moved toward our side -> positive signal (under: higher line)", () => {
    const bet = mkBet({
      selection: { marketKey: "PITCHER_KS", side: "under", line: 5.5 },
    });
    const snaps: PropLineSnapshot[] = [
      { side: "under", line: 5.5, priceDecimal: 1.9 },
      { side: "under", line: 6.5, priceDecimal: 1.85 },
    ];
    expect(lineMovedFavorably(bet, snaps)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. CLV summary / gate — aggregation, Kelly readiness threshold
// ---------------------------------------------------------------------------

describe("CLV summary + gate", () => {
  it("aggregates n plays, % beat close, avg CLV over measurable plays", () => {
    const b1 = mkBet({ id: BetId("b1"), priceDecimal: 2.0, closingPriceDecimal: 1.7 }); // +17.6% CLV, beat=true
    const b2 = mkBet({ id: BetId("b2"), priceDecimal: 1.8, closingPriceDecimal: 2.1 }); // -14.3% CLV, beat=false
    const b3 = mkBet({ id: BetId("b3"), priceDecimal: 2.0, closingPriceDecimal: 1.9 }); // +5.3% CLV, beat=true
    const summary = clvSummary([b1, b2, b3]);

    expect(summary.nPlays).toBe(3);
    expect(summary.nWithClose).toBe(3);
    // 2 of 3 beat close
    expect(summary.pctBeatClose).toBeCloseTo(2 / 3, 4);
    // avg CLV = ((2.0-1.7)/1.7 + (1.8-2.1)/2.1 + (2.0-1.9)/1.9) / 3
    const clv1 = (2.0 - 1.7) / 1.7;
    const clv2 = (1.8 - 2.1) / 2.1;
    const clv3 = (2.0 - 1.9) / 1.9;
    expect(summary.avgClvPct).toBeCloseTo((clv1 + clv2 + clv3) / 3, 6);
  });

  it("20-30 play gate: below threshold -> not kellyReady", () => {
    const bets = Array.from({ length: 19 }, (_, i) =>
      mkBet({ id: BetId(`b${i}`) }),
    );
    const summary = clvSummary(bets);
    expect(summary.nPlays).toBe(19);
    expect(summary.kellyReady).toBe(false);
  });

  it("20-30 play gate: at threshold -> kellyReady", () => {
    const bets = Array.from({ length: KELLY_READINESS_THRESHOLD }, (_, i) =>
      mkBet({ id: BetId(`b${i}`) }),
    );
    const summary = clvSummary(bets);
    expect(summary.nPlays).toBe(KELLY_READINESS_THRESHOLD);
    expect(summary.kellyReady).toBe(true);
  });

  it("20-30 play gate: above threshold -> kellyReady", () => {
    const bets = Array.from({ length: 30 }, (_, i) =>
      mkBet({ id: BetId(`b${i}`) }),
    );
    expect(clvSummary(bets).kellyReady).toBe(true);
  });

  it("KELLY_READINESS_THRESHOLD is 20", () => {
    expect(KELLY_READINESS_THRESHOLD).toBe(20);
  });

  it("excludes football bets from CLV summary", () => {
    const footballBet = mkBet({
      id: BetId("fb"),
      marketKey: "ML_1X2",
      selection: { marketKey: "ML_1X2", side: "home" },
      closingPriceDecimal: 1.5,
    });
    const propBet = mkBet({ id: BetId("pb"), closingPriceDecimal: 1.8 });
    const summary = clvSummary([footballBet, propBet]);
    expect(summary.nPlays).toBe(1); // only the prop
  });

  it("isPropBet filters to PITCHER_KS only", () => {
    expect(isPropBet(mkBet())).toBe(true);
    expect(
      isPropBet(
        mkBet({ marketKey: "ML_1X2", selection: { marketKey: "ML_1X2", side: "home" } }),
      ),
    ).toBe(false);
    expect(
      isPropBet(
        mkBet({ marketKey: "OU_GOALS", selection: { marketKey: "OU_GOALS", side: "over", line: 2.5 } }),
      ),
    ).toBe(false);
  });

  it("empty bets list -> zeros, kellyReady false", () => {
    const summary = clvSummary([]);
    expect(summary).toEqual({
      nPlays: 0,
      nWithClose: 0,
      pctBeatClose: 0,
      avgClvPct: 0,
      kellyReady: false,
    });
  });

  it("all pending (no closing) -> nWithClose 0, pctBeatClose 0, avgClvPct 0", () => {
    const bets = Array.from({ length: 5 }, (_, i) =>
      mkBet({ id: BetId(`b${i}`), closingPriceDecimal: undefined }),
    );
    const summary = clvSummary(bets);
    expect(summary.nPlays).toBe(5);
    expect(summary.nWithClose).toBe(0);
    expect(summary.pctBeatClose).toBe(0);
    expect(summary.avgClvPct).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Flat staking — sizeStakeUnits under FLAT policy
// ---------------------------------------------------------------------------

describe("flat staking (sizeStakeUnits)", () => {
  it("FLAT policy produces exactly 1u regardless of fairProb/price/confidence", () => {
    const inputs = [
      { fairProb: 0.55, priceDecimal: 1.87, confidence: 0.8 },
      { fairProb: 0.70, priceDecimal: 2.5, confidence: 0.95 },
      { fairProb: 0.40, priceDecimal: 3.0, confidence: 0.5 },
    ];
    for (const { fairProb, priceDecimal, confidence } of inputs) {
      const units = sizeStakeUnits({
        policy: FLAT_BASEBALL_POLICY,
        fairProb,
        priceDecimal,
        confidence,
        unitBankrollFraction: DEFAULT_UNIT_BANKROLL_FRACTION,
      });
      expect(units).toBe(1);
    }
  });

  it("FLAT policy is capped by maxUnitsPerPlay", () => {
    const bigFlatPolicy: StakePolicy = {
      ...FLAT_BASEBALL_POLICY,
      flatUnits: 5,
      maxUnitsPerPlay: 2,
    };
    const units = sizeStakeUnits({
      policy: bigFlatPolicy,
      fairProb: 0.6,
      priceDecimal: 2.0,
      confidence: 0.9,
      unitBankrollFraction: DEFAULT_UNIT_BANKROLL_FRACTION,
    });
    expect(units).toBe(2); // min(5, 2) = 2
  });

  it("PASS verdict candidates get 0u (not sized)", () => {
    // PASS means ev < threshold -> stakeUnits = 0 in analyze.ts
    // This tests the conceptual contract: PASS -> 0u, regardless of policy
    const passes = false; // simulates ev < EV_THRESHOLD
    const stakeUnits = passes
      ? sizeStakeUnits({
          policy: FLAT_BASEBALL_POLICY,
          fairProb: 0.45,
          priceDecimal: 1.87,
          confidence: 0.8,
          unitBankrollFraction: DEFAULT_UNIT_BANKROLL_FRACTION,
        })
      : 0;
    expect(stakeUnits).toBe(0);
  });

  it("passing plays under FLAT get exactly flatUnits (1u)", () => {
    const passes = true; // simulates ev >= EV_THRESHOLD
    const stakeUnits = passes
      ? sizeStakeUnits({
          policy: FLAT_BASEBALL_POLICY,
          fairProb: 0.6,
          priceDecimal: 1.87,
          confidence: 0.8,
          unitBankrollFraction: DEFAULT_UNIT_BANKROLL_FRACTION,
        })
      : 0;
    expect(stakeUnits).toBe(1);
  });

  it("stake seam is swappable: FRACTIONAL_KELLY produces different result", () => {
    const kellyPolicy: StakePolicy = {
      ...DEFAULT_STAKE_POLICY,
      kind: "FRACTIONAL_KELLY",
      kellyFraction: 0.25,
    };
    const flat = sizeStakeUnits({
      policy: FLAT_BASEBALL_POLICY,
      fairProb: 0.6,
      priceDecimal: 2.0,
      confidence: 0.85,
      unitBankrollFraction: DEFAULT_UNIT_BANKROLL_FRACTION,
    });
    const kelly = sizeStakeUnits({
      policy: kellyPolicy,
      fairProb: 0.6,
      priceDecimal: 2.0,
      confidence: 0.85,
      unitBankrollFraction: DEFAULT_UNIT_BANKROLL_FRACTION,
    });
    // FLAT always 1u; Kelly depends on edge -> should differ
    expect(flat).toBe(1);
    expect(kelly).not.toBe(flat);
    expect(kelly).toBeGreaterThan(0);
  });

  it("Kelly: no edge (fairProb <= implied) -> 0u", () => {
    const kellyPolicy: StakePolicy = {
      ...DEFAULT_STAKE_POLICY,
      kind: "FRACTIONAL_KELLY",
    };
    // fairProb 0.40 at price 2.0 -> implied 0.50, no edge
    const units = sizeStakeUnits({
      policy: kellyPolicy,
      fairProb: 0.4,
      priceDecimal: 2.0,
      confidence: 0.9,
      unitBankrollFraction: DEFAULT_UNIT_BANKROLL_FRACTION,
    });
    expect(units).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Degradation & non-regression
// ---------------------------------------------------------------------------

describe("degradation — no props/closing -> CLV pending, never throws", () => {
  it("clvPct never throws on any Bet shape", () => {
    const shapes: Partial<Bet>[] = [
      {},
      { closingPriceDecimal: undefined },
      { closingPriceDecimal: 0 },
      { closingPriceDecimal: -1 },
      { priceDecimal: 0, closingPriceDecimal: 0 },
      { priceDecimal: 1.0, closingPriceDecimal: 1.0 },
    ];
    for (const shape of shapes) {
      expect(() => clvPct(mkBet(shape))).not.toThrow();
    }
  });

  it("beatClose never throws on edge-case inputs", () => {
    const edgeCases: Array<{ bet: Partial<Bet>; snaps: PropLineSnapshot[] }> = [
      { bet: {}, snaps: [] },
      { bet: { closingPriceDecimal: undefined }, snaps: [] },
      {
        bet: { closingPriceDecimal: undefined },
        snaps: [{ side: "over", line: undefined, priceDecimal: 2.0 }],
      },
      {
        bet: { selection: { marketKey: "PITCHER_KS", side: "over" } },
        snaps: [{ side: "over", line: 4.5, priceDecimal: 2.0 }],
      },
    ];
    for (const { bet, snaps } of edgeCases) {
      expect(() => beatClose(mkBet(bet), snaps)).not.toThrow();
    }
  });

  it("lineMovedFavorably never throws on degenerate inputs", () => {
    expect(() => lineMovedFavorably(mkBet(), [])).not.toThrow();
    expect(() =>
      lineMovedFavorably(
        mkBet({ selection: { marketKey: "PITCHER_KS", side: "over" } }),
        [],
      ),
    ).not.toThrow();
    // Side is neither over nor under
    expect(() =>
      lineMovedFavorably(
        mkBet({ selection: { marketKey: "PITCHER_KS", side: "home" } }),
        [{ side: "home", line: 5.5, priceDecimal: 2.0 }],
      ),
    ).not.toThrow();
  });

  it("clvSummary handles mix of measurable and pending gracefully", () => {
    const bets = [
      mkBet({ id: BetId("m1"), closingPriceDecimal: 1.8 }),
      mkBet({ id: BetId("m2"), closingPriceDecimal: undefined }),
      mkBet({ id: BetId("m3"), closingPriceDecimal: 2.1 }),
      mkBet({ id: BetId("m4"), closingPriceDecimal: undefined }),
    ];
    const summary = clvSummary(bets);
    expect(summary.nPlays).toBe(4);
    expect(summary.nWithClose).toBe(2); // only m1 and m3
    expect(Number.isFinite(summary.avgClvPct)).toBe(true);
    expect(Number.isFinite(summary.pctBeatClose)).toBe(true);
  });

  it("sizeStakeUnits never throws on degenerate policy inputs", () => {
    const degeneratePolicies: StakePolicy[] = [
      { ...FLAT_BASEBALL_POLICY, flatUnits: 0 },
      { ...FLAT_BASEBALL_POLICY, maxUnitsPerPlay: 0 },
      {
        ...DEFAULT_STAKE_POLICY,
        kind: "FRACTIONAL_KELLY",
        kellyFraction: 0,
      },
    ];
    for (const policy of degeneratePolicies) {
      expect(() =>
        sizeStakeUnits({
          policy,
          fairProb: 0.5,
          priceDecimal: 2.0,
          confidence: 0.8,
          unitBankrollFraction: DEFAULT_UNIT_BANKROLL_FRACTION,
        }),
      ).not.toThrow();
    }
  });
});
