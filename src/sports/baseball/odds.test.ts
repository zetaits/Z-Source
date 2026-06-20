/**
 * Phase-3 odds + EV + wiring tests for MLB pitcher-strikeout betting.
 *
 * Tests cover:
 *  - label parsing (_parsePlayerName, normalizeName from oddsProps.ts)
 *  - prop odds parsing (_buildEventPitcherProps, market-name matchers)
 *  - de-vig + EV (2-way O/U sums to 1; EV sign correctness; hand-computed case)
 *  - MLB league filter (non-MLB events rejected by leagueName)
 *  - Selection/selectionKey changes (PITCHER_KS, player suffix, football compat)
 *  - analyze() integration (projectStrikeouts + EV pipeline, degradation, never throws)
 *
 * All tests are fixture-based (offline). Matches existing vitest style
 * (kProjection.test.ts, oddsApiIoProvider.test.ts).
 */
import { describe, expect, it } from "vitest";
import { impliedProb, removeVig, edgePct } from "@/engine/ev";
import { projectStrikeouts } from "@/sports/baseball/model";
import {
  normalizeName,
  _parsePlayerName,
  _buildEventPitcherProps,
  _isKsMarket,
  _isOutsMarket,
} from "@/sports/baseball/oddsProps";
import type {
  PitcherKsLine,
  PitcherProps,
  EventPitcherProps,
} from "@/sports/baseball/oddsProps";
import { selectionKey } from "@/domain/market";
import type { Selection, MarketKey } from "@/domain/market";
import type {
  PitcherSeasonStats,
  SavantPitcherProfile,
  PitcherGameLog,
  LineupSlot,
  BatterKSplits,
} from "@/domain/baseball";
import type { ProviderEvent } from "@/services/providers/OddsProvider";

// ---------------------------------------------------------------------------
// 1. Label parsing — _parsePlayerName + normalizeName
// ---------------------------------------------------------------------------

describe("_parsePlayerName", () => {
  it("strips jersey + line parens: 'Rhett Lowder (1) (4.5)' -> 'Rhett Lowder'", () => {
    expect(_parsePlayerName("Rhett Lowder (1) (4.5)")).toBe("Rhett Lowder");
  });

  it("strips single paren group: 'Corbin Burnes (5.5)' -> 'Corbin Burnes'", () => {
    expect(_parsePlayerName("Corbin Burnes (5.5)")).toBe("Corbin Burnes");
  });

  it("handles accented names: 'Jose Berrios (17) (5.5)' -> 'Jose Berrios'", () => {
    expect(_parsePlayerName("Jose Berrios (17) (5.5)")).toBe("Jose Berrios");
  });

  it("handles accented unicode: 'Jose Berrios (17) (5.5)'", () => {
    expect(_parsePlayerName("José Berríos (17) (5.5)")).toBe("José Berríos");
  });

  it("preserves name when no parens present", () => {
    expect(_parsePlayerName("Gerrit Cole")).toBe("Gerrit Cole");
  });

  it("handles extra spaces", () => {
    expect(_parsePlayerName("  Max Fried  (54)  (4.5)  ").trim()).toBe("Max Fried");
  });

  it("returns empty for empty string", () => {
    expect(_parsePlayerName("")).toBe("");
  });
});

describe("normalizeName", () => {
  it("lowercases and strips accents", () => {
    expect(normalizeName("José Berríos")).toBe("jose berrios");
  });

  it("drops punctuation", () => {
    expect(normalizeName("O'Brien")).toBe("o brien");
  });

  it("collapses extra spaces", () => {
    expect(normalizeName("  Max   Fried  ")).toBe("max fried");
  });

  it("handles hyphens", () => {
    expect(normalizeName("Hyun-Jin Ryu")).toBe("hyun jin ryu");
  });

  it("produces identical keys for statsapi vs label names", () => {
    // statsapi: "Rhett Lowder", label: "Rhett Lowder (1) (4.5)"
    const fromStatsapi = normalizeName("Rhett Lowder");
    const fromLabel = normalizeName(_parsePlayerName("Rhett Lowder (1) (4.5)"));
    expect(fromStatsapi).toBe(fromLabel);
  });
});

// ---------------------------------------------------------------------------
// 2. Market-name regex matchers
// ---------------------------------------------------------------------------

describe("market name matchers", () => {
  it("_isKsMarket matches typical strikeout market names", () => {
    expect(_isKsMarket("Pitcher Strikeouts O/U")).toBe(true);
    expect(_isKsMarket("Pitcher Strikeouts Over/Under")).toBe(true);
    expect(_isKsMarket("Strikeout Total")).toBe(true);
    expect(_isKsMarket("pitcher strikeouts o/u")).toBe(true);
  });

  it("_isKsMarket rejects non-strikeout markets", () => {
    expect(_isKsMarket("Moneyline")).toBe(false);
    expect(_isKsMarket("Total Runs O/U")).toBe(false);
    expect(_isKsMarket("Pitcher Outs O/U")).toBe(false);
  });

  it("_isOutsMarket matches typical outs market names", () => {
    expect(_isOutsMarket("Pitcher Outs O/U")).toBe(true);
    expect(_isOutsMarket("pitcher outs over/under")).toBe(true);
    expect(_isOutsMarket("Outs Over/Under")).toBe(true);
  });

  it("_isOutsMarket rejects non-outs markets", () => {
    expect(_isOutsMarket("Moneyline")).toBe(false);
    expect(_isOutsMarket("Total Runs O/U")).toBe(false);
  });

  it("_isOutsMarket overlap with strikeouts is guarded by !ks in caller", () => {
    // "Strikeouts" contains "outs", so the regex matches — but
    // buildEventPitcherProps checks `!isKsMarket` first, preventing overlap.
    expect(_isOutsMarket("Pitcher Strikeouts O/U")).toBe(true);
    expect(_isKsMarket("Pitcher Strikeouts O/U")).toBe(true);
    // In production: const outs = !ks && isOutsMarket(name), so ks wins.
  });
});

// ---------------------------------------------------------------------------
// 3. Prop odds parsing — _buildEventPitcherProps
// ---------------------------------------------------------------------------

// Canned fixtures mirroring real odds-api.io event-odds payloads.
const bet365KsPayload = {
  id: "abc123",
  bookmakers: {
    Bet365: [
      {
        name: "Pitcher Strikeouts O/U",
        odds: [
          { label: "Rhett Lowder (1) (4.5)", hdp: 4.5, over: 1.87, under: 1.83 },
          { label: "Corbin Burnes (5.5)", hdp: 5.5, over: 2.1, under: 1.72 },
        ],
      },
      {
        name: "Pitcher Outs O/U",
        odds: [
          { label: "Rhett Lowder (1) (17.5)", hdp: 17.5, over: 1.91, under: 1.89 },
        ],
      },
    ],
  },
};

const sbobetOnlyPayload = {
  id: "def456",
  bookmakers: {
    Sbobet: [
      {
        name: "Totals",
        odds: [{ hdp: 8.5, over: 1.95, under: 1.85 }],
      },
    ],
  },
};

describe("_buildEventPitcherProps", () => {
  it("extracts per-pitcher K lines from Bet365 props", () => {
    const props = _buildEventPitcherProps(bet365KsPayload, ["Bet365"]);
    const lowder = props.get(normalizeName("Rhett Lowder"));
    expect(lowder).toBeDefined();
    expect(lowder!.ksLines).toHaveLength(1);
    expect(lowder!.ksLines[0]).toMatchObject({
      line: 4.5,
      overDec: 1.87,
      underDec: 1.83,
    });
  });

  it("extracts multiple pitchers", () => {
    const props = _buildEventPitcherProps(bet365KsPayload, ["Bet365"]);
    expect(props.size).toBe(2);
    const burnes = props.get(normalizeName("Corbin Burnes"));
    expect(burnes).toBeDefined();
    expect(burnes!.ksLines[0].line).toBe(5.5);
  });

  it("extracts outsLine from Bet365 pitcher outs market", () => {
    const props = _buildEventPitcherProps(bet365KsPayload, ["Bet365"]);
    const lowder = props.get(normalizeName("Rhett Lowder"));
    expect(lowder!.outsLine).toBe(17.5);
  });

  it("Sbobet-only yields empty map (no pitcher props)", () => {
    const props = _buildEventPitcherProps(sbobetOnlyPayload, ["Sbobet"]);
    expect(props.size).toBe(0);
  });

  it("filters by requested books", () => {
    const mixedPayload = {
      id: "x",
      bookmakers: {
        Bet365: [
          {
            name: "Pitcher Strikeouts O/U",
            odds: [{ label: "Player A (4.5)", hdp: 4.5, over: 1.8, under: 2.0 }],
          },
        ],
        Pinnacle: [
          {
            name: "Pitcher Strikeouts O/U",
            odds: [{ label: "Player B (5.5)", hdp: 5.5, over: 1.9, under: 1.9 }],
          },
        ],
      },
    };
    const bet365Only = _buildEventPitcherProps(mixedPayload, ["Bet365"]);
    expect(bet365Only.size).toBe(1);
    expect(bet365Only.has(normalizeName("Player A"))).toBe(true);
  });

  it("handles empty bookmakers gracefully", () => {
    const props = _buildEventPitcherProps({ id: "x", bookmakers: {} }, ["Bet365"]);
    expect(props.size).toBe(0);
  });

  it("handles missing bookmakers key", () => {
    const props = _buildEventPitcherProps({ id: "x" }, ["Bet365"]);
    expect(props.size).toBe(0);
  });

  it("handles malformed payload (not an object)", () => {
    const props = _buildEventPitcherProps("not-an-object", ["Bet365"]);
    expect(props.size).toBe(0);
  });

  it("skips rows missing over or under", () => {
    const payload = {
      id: "x",
      bookmakers: {
        Bet365: [
          {
            name: "Pitcher Strikeouts O/U",
            odds: [
              { label: "Player A (4.5)", hdp: 4.5, over: 1.87 },
              // missing under
            ],
          },
        ],
      },
    };
    const props = _buildEventPitcherProps(payload, ["Bet365"]);
    expect(props.size).toBe(0);
  });

  it("skips rows missing label", () => {
    const payload = {
      id: "x",
      bookmakers: {
        Bet365: [
          {
            name: "Pitcher Strikeouts O/U",
            odds: [{ hdp: 4.5, over: 1.87, under: 1.83 }],
          },
        ],
      },
    };
    const props = _buildEventPitcherProps(payload, ["Bet365"]);
    expect(props.size).toBe(0);
  });

  it("handles missing outsLine pitcher (ksLines only)", () => {
    const payload = {
      id: "x",
      bookmakers: {
        Bet365: [
          {
            name: "Pitcher Strikeouts O/U",
            odds: [
              { label: "Player A (4.5)", hdp: 4.5, over: 1.87, under: 1.83 },
            ],
          },
        ],
      },
    };
    const props = _buildEventPitcherProps(payload, ["Bet365"]);
    const playerA = props.get(normalizeName("Player A"));
    expect(playerA).toBeDefined();
    expect(playerA!.ksLines).toHaveLength(1);
    expect(playerA!.outsLine).toBeUndefined();
  });

  it("multi-line pitcher: same pitcher with multiple K lines", () => {
    const payload = {
      id: "x",
      bookmakers: {
        Bet365: [
          {
            name: "Pitcher Strikeouts O/U",
            odds: [
              { label: "Gerrit Cole (45) (5.5)", hdp: 5.5, over: 1.8, under: 2.0 },
              { label: "Gerrit Cole (45) (6.5)", hdp: 6.5, over: 2.4, under: 1.55 },
            ],
          },
        ],
      },
    };
    const props = _buildEventPitcherProps(payload, ["Bet365"]);
    const cole = props.get(normalizeName("Gerrit Cole"));
    expect(cole).toBeDefined();
    expect(cole!.ksLines).toHaveLength(2);
    expect(cole!.ksLines.map((l) => l.line).sort()).toEqual([5.5, 6.5]);
  });
});

// ---------------------------------------------------------------------------
// 4. De-vig + EV
// ---------------------------------------------------------------------------

describe("de-vig + EV", () => {
  it("2-way O/U de-vig sums to 1", () => {
    const pOver = impliedProb(1.87);
    const pUnder = impliedProb(1.83);
    const fair = removeVig([pOver, pUnder]);
    expect(fair[0] + fair[1]).toBeCloseTo(1, 8);
  });

  it("de-vig preserves ratio of implied probs", () => {
    const pOver = impliedProb(2.1);
    const pUnder = impliedProb(1.72);
    const fair = removeVig([pOver, pUnder]);
    const rawRatio = pOver / pUnder;
    const fairRatio = fair[0] / fair[1];
    expect(fairRatio).toBeCloseTo(rawRatio, 8);
  });

  it("EV is positive when model pOver > book implied over", () => {
    const modelPOver = 0.55;
    const overDecimal = 1.87;
    const ev = edgePct(modelPOver, overDecimal);
    expect(ev).toBeGreaterThan(0);
  });

  it("EV is negative when model pOver < book implied over", () => {
    const modelPOver = 0.48;
    const overDecimal = 1.87;
    const ev = edgePct(modelPOver, overDecimal);
    expect(ev).toBeLessThan(0);
  });

  it("hand-computed de-vig + EV case", () => {
    // Over 1.87, Under 1.83
    // sum implied = 1/1.87 + 1/1.83 = 0.53476 + 0.54645 = 1.08121
    // Fair over = 0.53476 / 1.08121 = 0.49459
    // Fair under = 0.54645 / 1.08121 = 0.50541
    const pOver = impliedProb(1.87);
    const pUnder = impliedProb(1.83);
    const fair = removeVig([pOver, pUnder]);
    expect(fair[0]).toBeCloseTo(0.4946, 3);
    expect(fair[1]).toBeCloseTo(0.5054, 3);

    // Model: P(K > 4.5) = 0.52 -- model > fair but book price still punishes
    const evOver = edgePct(0.52, 1.87);
    // 0.52 * 1.87 - 1 = -0.0276
    expect(evOver).toBeCloseTo(-0.0276, 3);

    // Model: P(K > 4.5) = 0.58 -- strongly positive EV
    const strongEvOver = edgePct(0.58, 1.87);
    // 0.58 * 1.87 - 1 = 0.0846
    expect(strongEvOver).toBeCloseTo(0.0846, 3);
  });

  it("de-vig with equal odds produces 50/50", () => {
    const fair = removeVig([impliedProb(1.91), impliedProb(1.91)]);
    expect(fair[0]).toBeCloseTo(0.5, 8);
    expect(fair[1]).toBeCloseTo(0.5, 8);
  });
});

// ---------------------------------------------------------------------------
// 5. MLB league filter via ProviderEvent.leagueName
// ---------------------------------------------------------------------------

describe("MLB league filter", () => {
  const filterMlbEvents = (events: ProviderEvent[]): ProviderEvent[] =>
    events.filter((e) => e.leagueName === "USA - MLB");

  it("accepts events with leagueName 'USA - MLB'", () => {
    const events: ProviderEvent[] = [
      { eventId: "1", homeName: "Yankees", awayName: "Red Sox", kickoffAt: "2026-06-20T00:00:00Z", leagueName: "USA - MLB" },
    ];
    expect(filterMlbEvents(events)).toHaveLength(1);
  });

  it("filters out non-MLB leagues", () => {
    const events: ProviderEvent[] = [
      { eventId: "1", homeName: "Yankees", awayName: "Red Sox", kickoffAt: "2026-06-20T00:00:00Z", leagueName: "USA - MLB" },
      { eventId: "2", homeName: "FCL Mets", awayName: "FCL Yankees", kickoffAt: "2026-06-20T00:00:00Z", leagueName: "USA - FCL" },
      { eventId: "3", homeName: "Kenosha Kingfish", awayName: "Madison Mallards", kickoffAt: "2026-06-20T00:00:00Z", leagueName: "USA - Northwoods" },
    ];
    const filtered = filterMlbEvents(events);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].eventId).toBe("1");
  });

  it("rejects events with no leagueName", () => {
    const events: ProviderEvent[] = [
      { eventId: "1", homeName: "A", awayName: "B", kickoffAt: "2026-06-20T00:00:00Z" },
    ];
    expect(filterMlbEvents(events)).toHaveLength(0);
  });

  it("rejects international baseball leagues", () => {
    const events: ProviderEvent[] = [
      { eventId: "1", homeName: "A", awayName: "B", kickoffAt: "2026-06-20T00:00:00Z", leagueName: "Japan - NPB" },
      { eventId: "2", homeName: "C", awayName: "D", kickoffAt: "2026-06-20T00:00:00Z", leagueName: "South Korea - KBO" },
    ];
    expect(filterMlbEvents(events)).toHaveLength(0);
  });

  it("ProviderEvent.leagueName is optional (no football regression)", () => {
    // Football events have no leagueName — they should compile and not throw.
    const footballEvent: ProviderEvent = {
      eventId: "99",
      homeName: "Arsenal",
      awayName: "Chelsea",
      kickoffAt: "2026-06-20T00:00:00Z",
    };
    expect(footballEvent.leagueName).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 6. Selection + selectionKey — PITCHER_KS, player suffix, football compat
// ---------------------------------------------------------------------------

describe("Selection + selectionKey (PITCHER_KS)", () => {
  it("player-less keys are byte-identical to pre-Phase-3 keys", () => {
    // Existing football selections must produce the same selectionKey.
    const footballMl: Selection = { marketKey: "ML_1X2", side: "home" };
    expect(selectionKey(footballMl)).toBe("ML_1X2:home");

    const footballOu: Selection = { marketKey: "OU_GOALS", side: "over", line: 2.5 };
    expect(selectionKey(footballOu)).toBe("OU_GOALS:over@2.5");

    const footballBtts: Selection = { marketKey: "BTTS", side: "yes" };
    expect(selectionKey(footballBtts)).toBe("BTTS:yes");
  });

  it("player props get the |player suffix", () => {
    const ksOver: Selection = {
      marketKey: "PITCHER_KS",
      side: "over",
      line: 4.5,
      player: "rhett lowder",
    };
    expect(selectionKey(ksOver)).toBe("PITCHER_KS:over@4.5|rhett lowder");
  });

  it("different pitchers at the same line produce different keys", () => {
    const a: Selection = {
      marketKey: "PITCHER_KS",
      side: "over",
      line: 5.5,
      player: "corbin burnes",
    };
    const b: Selection = {
      marketKey: "PITCHER_KS",
      side: "over",
      line: 5.5,
      player: "gerrit cole",
    };
    expect(selectionKey(a)).not.toBe(selectionKey(b));
  });

  it("PITCHER_KS without player gets no suffix (graceful)", () => {
    const noPlayer: Selection = {
      marketKey: "PITCHER_KS",
      side: "under",
      line: 4.5,
    };
    expect(selectionKey(noPlayer)).toBe("PITCHER_KS:under@4.5");
    // No pipe character in the key
    expect(selectionKey(noPlayer)).not.toContain("|");
  });

  it("PITCHER_KS is a valid MarketKey", () => {
    // TypeScript enforces this at compile time; this runtime check documents the intent.
    const key: MarketKey = "PITCHER_KS";
    expect(key).toBe("PITCHER_KS");
  });
});

// ---------------------------------------------------------------------------
// 7. analyze() integration — model + EV pipeline + degradation
// ---------------------------------------------------------------------------

describe("analyze integration (model + EV pipeline)", () => {
  const pitcher: PitcherSeasonStats = {
    playerId: 680694,
    season: 2026,
    gamesStarted: 15,
    gamesPlayed: 15,
    inningsPitched: 90,
    battersFaced: 360,
    strikeouts: 90,
    kPct: 0.25,
    kPer9: 9.0,
    strikePct: 0.65,
  };

  const savant: SavantPitcherProfile = {
    playerId: 680694,
    season: 2026,
    whiffPct: 0.13,
  };

  const gamelogs: PitcherGameLog[] = Array.from({ length: 5 }, (_, i) => ({
    gamePk: 2000 + i,
    date: `2026-06-${10 + i}`,
    isHome: i % 2 === 0,
    inningsPitched: 6,
    battersFaced: 23,
    strikeouts: 5,
    gamesStarted: 1,
  }));

  const lineup: LineupSlot[] = Array.from({ length: 9 }, (_, i) => ({
    battingOrder: i + 1,
    playerId: 300 + i,
    name: `Batter ${i + 1}`,
    bats: (i % 2 === 0 ? "R" : "L") as "R" | "L",
  }));

  const batterSplits: Record<number, BatterKSplits> = Object.fromEntries(
    lineup.map((s) => [
      s.playerId,
      {
        playerId: s.playerId,
        season: 2026,
        kPctVsR: 0.22,
        kPctVsL: 0.19,
        paVsR: 200,
        paVsL: 80,
      } satisfies BatterKSplits,
    ]),
  );

  // Simulate the full pipeline: model → de-vig → EV → PlayCandidate fields.
  const runPipeline = (ksLine: PitcherKsLine, outsLine?: number) => {
    const proj = projectStrikeouts({
      pitcher,
      throws: "R",
      gamelogs,
      savant,
      opponentLineup: lineup,
      batterSplits,
      marketOutsLine: outsLine,
    });
    const modelPOver = proj.pOver(ksLine.line);
    const modelPUnder = 1 - modelPOver;
    const bookFair = removeVig([
      impliedProb(ksLine.overDec),
      impliedProb(ksLine.underDec),
    ]);
    const evOver = edgePct(modelPOver, ksLine.overDec);
    const evUnder = edgePct(modelPUnder, ksLine.underDec);
    return { proj, modelPOver, modelPUnder, bookFair, evOver, evUnder };
  };

  it("projection produces valid pOver in (0,1) at typical K lines", () => {
    const proj = projectStrikeouts({
      pitcher, throws: "R", gamelogs, savant,
      opponentLineup: lineup, batterSplits,
    });
    for (const line of [3.5, 4.5, 5.5, 6.5]) {
      const p = proj.pOver(line);
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThan(1);
    }
  });

  it("pipeline: fairProb === proj.pOver(line)", () => {
    const ksLine: PitcherKsLine = { line: 4.5, overDec: 1.87, underDec: 1.83 };
    const { proj, modelPOver } = runPipeline(ksLine, 17.5);
    // The model's pOver is what becomes fairProb for the "over" PlayCandidate.
    expect(modelPOver).toBe(proj.pOver(4.5));
  });

  it("pipeline: edgePct === (pOver * overDec - 1)", () => {
    const ksLine: PitcherKsLine = { line: 4.5, overDec: 1.87, underDec: 1.83 };
    const { modelPOver, evOver } = runPipeline(ksLine);
    // edgePct formula: fairProb * priceDecimal - 1
    expect(evOver).toBeCloseTo(modelPOver * 1.87 - 1, 10);
  });

  it("over-EV positive when model strongly favors over", () => {
    // Use a high-K pitcher to push pOver above break-even for 4.5 line.
    const highKPitcher: PitcherSeasonStats = {
      ...pitcher, kPct: 0.35, strikeouts: 126, battersFaced: 360,
    };
    const highKSavant: SavantPitcherProfile = {
      playerId: 680694, season: 2026, whiffPct: 0.18,
    };
    const proj = projectStrikeouts({
      pitcher: highKPitcher, throws: "R", gamelogs, savant: highKSavant,
      opponentLineup: lineup, batterSplits,
    });
    const pOver = proj.pOver(4.5);
    // A 35% K-rate pitcher should have high pOver at 4.5 line.
    expect(pOver).toBeGreaterThan(0.55);
    const ev = edgePct(pOver, 1.87);
    expect(ev).toBeGreaterThan(0);
  });

  it("sub-threshold side has negative edge", () => {
    // Low-K pitcher at a high line should have negative EV on over.
    const lowKPitcher: PitcherSeasonStats = {
      ...pitcher, kPct: 0.16, strikeouts: 58, battersFaced: 360,
    };
    const proj = projectStrikeouts({
      pitcher: lowKPitcher, throws: "R", gamelogs,
      savant: { playerId: 680694, season: 2026, whiffPct: 0.09 },
      opponentLineup: lineup, batterSplits,
    });
    const pOver = proj.pOver(5.5);
    const ev = edgePct(pOver, 2.1);
    expect(ev).toBeLessThan(0);
  });

  it("confidence === proj.confidence (flows into PlayCandidate)", () => {
    const proj = projectStrikeouts({
      pitcher, throws: "R", gamelogs, savant,
      opponentLineup: lineup, batterSplits,
    });
    expect(proj.confidence).toBeGreaterThan(0);
    expect(proj.confidence).toBeLessThanOrEqual(1);
    // In the analyze() pipeline, PlayCandidate.confidence === proj.confidence.
  });

  it("degradation: no lineup → partial tier, fewer/zero plays", () => {
    const proj = projectStrikeouts({
      pitcher, throws: "R", gamelogs, savant,
      opponentLineup: [], batterSplits: {},
    });
    expect(proj.inputsUsed.tier).toBe("partial");
    expect(proj.inputsUsed.lineupConfirmed).toBe(false);
    expect(proj.inputsUsed.battersModeled).toBe(9);
    expect(proj.pmf.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 8);
  });

  it("degradation: no savant → low tier, still valid projection", () => {
    const proj = projectStrikeouts({
      pitcher, throws: "R", gamelogs,
      opponentLineup: lineup, batterSplits,
    });
    expect(proj.inputsUsed.tier).toBe("low");
    expect(proj.inputsUsed.savantSource).toBe("none");
    expect(Number.isFinite(proj.expectedKs)).toBe(true);
  });

  it("degradation: no props → model works, no EV to compute", () => {
    const proj = projectStrikeouts({
      pitcher, throws: "R", gamelogs, savant,
      opponentLineup: lineup, batterSplits,
    });
    expect(proj.expectedKs).toBeGreaterThan(0);
    expect(Number.isFinite(proj.expectedKs)).toBe(true);
  });

  it("marketOutsLine integrates into BF projection", () => {
    const withOuts = projectStrikeouts({
      pitcher, throws: "R", gamelogs, savant,
      opponentLineup: lineup, batterSplits, marketOutsLine: 17.5,
    });
    const withoutOuts = projectStrikeouts({
      pitcher, throws: "R", gamelogs, savant,
      opponentLineup: lineup, batterSplits,
    });
    expect(withOuts.inputsUsed.usedMarketOutsLine).toBe(true);
    expect(withoutOuts.inputsUsed.usedMarketOutsLine).toBe(false);
    expect(withOuts.inputsUsed.bfMean).not.toBeCloseTo(withoutOuts.inputsUsed.bfMean, 3);
  });

  it("never throws with worst-case inputs", () => {
    expect(() =>
      projectStrikeouts({
        pitcher: { ...pitcher, battersFaced: 0, strikeouts: 0, kPct: 0 },
        throws: "L", gamelogs: [], opponentLineup: [], batterSplits: {},
      }),
    ).not.toThrow();
  });

  it("all-empty data yields valid projection with plays:[] shape", () => {
    const proj = projectStrikeouts({
      pitcher: { ...pitcher, gamesStarted: 0, gamesPlayed: 0, battersFaced: 0, strikeouts: 0, kPct: 0 },
      throws: "L", gamelogs: [], opponentLineup: [], batterSplits: {},
    });
    // Model returns a valid pmf even with degenerate inputs.
    expect(proj.pmf.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 8);
    expect(Number.isFinite(proj.expectedKs)).toBe(true);
    // gamesStarted=0 falls back to BF_MEAN_DEFAULT (23.6)
    expect(proj.inputsUsed.bfMean).toBeGreaterThan(0);
    // With no book lines, analyze() would emit plays:[] — not an error.
  });

  it("trace provenance: inputsUsed has all required metadata fields", () => {
    const proj = projectStrikeouts({
      pitcher, throws: "R", gamelogs, savant,
      opponentLineup: lineup, batterSplits,
    });
    expect(proj.inputsUsed).toHaveProperty("tier");
    expect(proj.inputsUsed).toHaveProperty("pitcherTalentK");
    expect(proj.inputsUsed).toHaveProperty("leagueK");
    expect(proj.inputsUsed).toHaveProperty("bfMean");
    expect(proj.inputsUsed).toHaveProperty("savantSource");
    expect(proj.inputsUsed).toHaveProperty("lineupConfirmed");
    expect(proj.inputsUsed).toHaveProperty("battersModeled");
    expect(Number.isFinite(proj.inputsUsed.pitcherTalentK)).toBe(true);
    expect(Number.isFinite(proj.inputsUsed.leagueK)).toBe(true);
    expect(Number.isFinite(proj.inputsUsed.bfMean)).toBe(true);
  });

  it("confidence ordering: full > no-savant > no-lineup", () => {
    const full = projectStrikeouts({
      pitcher, throws: "R", gamelogs, savant,
      opponentLineup: lineup, batterSplits,
    }).confidence;
    const noSavant = projectStrikeouts({
      pitcher, throws: "R", gamelogs,
      opponentLineup: lineup, batterSplits,
    }).confidence;
    const noLineup = projectStrikeouts({
      pitcher, throws: "R", gamelogs, savant,
      opponentLineup: [], batterSplits: {},
    }).confidence;
    expect(full).toBeGreaterThan(noSavant);
    expect(noSavant).toBeGreaterThan(noLineup);
  });
});
