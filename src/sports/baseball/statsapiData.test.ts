import { describe, expect, it } from "vitest";
import {
  _pickCombinedSplit,
  _mapScheduleGame,
  _mapLineup,
  _mapPitcherSeason,
  _mapGameLogs,
  _mapPlayerHands,
  _mapBatterKSplits,
} from "./statsapiData";

// ---------------------------------------------------------------------------
// _pickCombinedSplit
// ---------------------------------------------------------------------------
describe("_pickCombinedSplit", () => {
  it("returns undefined for empty splits", () => {
    expect(_pickCombinedSplit([])).toBeUndefined();
  });

  it("returns the only split when there is one (single-team pitcher)", () => {
    const single = [{ season: "2025", stat: { era: "2.21" } }];
    expect(_pickCombinedSplit(single)).toBe(single[0]);
  });

  it("prefers the combined split for a traded pitcher (numTeams >= 2, no team)", () => {
    const perTeam = { season: "2025", numTeams: 1, team: { id: 116 }, stat: { era: "3.50" } };
    const combined = { season: "2025", numTeams: 2, stat: { era: "2.80" } };
    expect(_pickCombinedSplit([perTeam, combined])).toBe(combined);
  });

  it("falls back to splits[0] when no combined split exists", () => {
    const a = { season: "2025", numTeams: 1, team: { id: 116 }, stat: { era: "3.00" } };
    const b = { season: "2025", numTeams: 1, team: { id: 147 }, stat: { era: "4.00" } };
    expect(_pickCombinedSplit([a, b])).toBe(a);
  });

  it("does NOT pick a split with numTeams >= 2 if it also has a team field", () => {
    const withTeam = { season: "2025", numTeams: 2, team: { id: 116 }, stat: {} };
    const plain = { season: "2025", stat: { era: "3.00" } };
    // withTeam has team defined -> not the combined one; falls back to [0]
    expect(_pickCombinedSplit([withTeam, plain])).toBe(withTeam);
  });
});

// ---------------------------------------------------------------------------
// _mapScheduleGame
// ---------------------------------------------------------------------------
const sampleScheduleGame = {
  gamePk: 778546,
  dayNight: "night",
  venue: { id: 12, name: "Comerica Park" },
  weather: { temp: "72", condition: "Clear", wind: "8mph Out To CF" },
  teams: {
    home: { probablePitcher: { id: 669373, fullName: "Tarik Skubal" } },
    away: { probablePitcher: { id: 543037, fullName: "Clayton Kershaw" } },
  },
};

describe("_mapScheduleGame", () => {
  it("extracts both probable pitchers with correct teamSide", () => {
    const { probables } = _mapScheduleGame(sampleScheduleGame, 0);
    expect(probables).toHaveLength(2);
    expect(probables[0]).toEqual({ playerId: 669373, name: "Tarik Skubal", teamSide: "home" });
    expect(probables[1]).toEqual({ playerId: 543037, name: "Clayton Kershaw", teamSide: "away" });
  });

  it("uses gamePk from game, not fallback", () => {
    const { context } = _mapScheduleGame(sampleScheduleGame, 999);
    expect(context.gamePk).toBe(778546);
  });

  it("falls back to fallbackPk when gamePk is missing", () => {
    const game = { ...sampleScheduleGame, gamePk: undefined };
    const { context } = _mapScheduleGame(game, 999);
    expect(context.gamePk).toBe(999);
  });

  it("maps venue and dayNight", () => {
    const { context } = _mapScheduleGame(sampleScheduleGame, 0);
    expect(context.venueId).toBe(12);
    expect(context.venueName).toBe("Comerica Park");
    expect(context.dayNight).toBe("night");
  });

  it("maps weather when condition is present", () => {
    const { context } = _mapScheduleGame(sampleScheduleGame, 0);
    expect(context.weather).toEqual({ tempF: 72, condition: "Clear", wind: "8mph Out To CF" });
  });

  it("omits weather when condition is absent (future game)", () => {
    const futureGame = { ...sampleScheduleGame, weather: { temp: "70" } };
    const { context } = _mapScheduleGame(futureGame, 0);
    expect(context.weather).toBeUndefined();
  });

  it("omits weather entirely when the field is missing", () => {
    const { weather: _w, ...noWeather } = sampleScheduleGame;
    const { context } = _mapScheduleGame(noWeather, 0);
    expect(context.weather).toBeUndefined();
  });

  it("maps dayNight 'day' correctly", () => {
    const dayGame = { ...sampleScheduleGame, dayNight: "day" };
    const { context } = _mapScheduleGame(dayGame, 0);
    expect(context.dayNight).toBe("day");
  });

  it("maps invalid dayNight to undefined", () => {
    const unknownDN = { ...sampleScheduleGame, dayNight: "twilight" };
    const { context } = _mapScheduleGame(unknownDN, 0);
    expect(context.dayNight).toBeUndefined();
  });

  it("returns empty probables when neither pitcher announced", () => {
    const noPitchers = { ...sampleScheduleGame, teams: { home: {}, away: {} } };
    const { probables } = _mapScheduleGame(noPitchers, 0);
    expect(probables).toHaveLength(0);
  });

  it("returns one probable when only home pitcher announced", () => {
    const homeOnly = {
      ...sampleScheduleGame,
      teams: {
        home: { probablePitcher: { id: 669373, fullName: "Tarik Skubal" } },
        away: {},
      },
    };
    const { probables } = _mapScheduleGame(homeOnly, 0);
    expect(probables).toHaveLength(1);
    expect(probables[0].teamSide).toBe("home");
  });

  it("defaults fullName to empty string when missing", () => {
    const noName = {
      ...sampleScheduleGame,
      teams: { home: { probablePitcher: { id: 669373 } }, away: {} },
    };
    const { probables } = _mapScheduleGame(noName, 0);
    expect(probables[0].name).toBe("");
  });
});

// ---------------------------------------------------------------------------
// _mapLineup
// ---------------------------------------------------------------------------
describe("_mapLineup", () => {
  const lineupPayload = {
    dates: [
      {
        games: [
          {
            gamePk: 778546,
            lineups: {
              homePlayers: [
                { id: 660271, fullName: "Shohei Ohtani", primaryPosition: { abbreviation: "DH" } },
                { id: 605141, fullName: "Mookie Betts", primaryPosition: { abbreviation: "RF" } },
              ],
              awayPlayers: [
                { id: 665489, fullName: "Matt Olson", primaryPosition: { abbreviation: "1B" } },
              ],
            },
          },
        ],
      },
    ],
  };

  it("maps home lineup with battingOrder = index + 1", () => {
    const lineup = _mapLineup(lineupPayload, 778546);
    expect(lineup.home).toHaveLength(2);
    expect(lineup.home[0]).toEqual({
      battingOrder: 1,
      playerId: 660271,
      name: "Shohei Ohtani",
      position: "DH",
    });
    expect(lineup.home[1].battingOrder).toBe(2);
  });

  it("maps away lineup", () => {
    const lineup = _mapLineup(lineupPayload, 778546);
    expect(lineup.away).toHaveLength(1);
    expect(lineup.away[0].battingOrder).toBe(1);
    expect(lineup.away[0].playerId).toBe(665489);
  });

  it("sets confirmed = true when at least one side has players", () => {
    const lineup = _mapLineup(lineupPayload, 778546);
    expect(lineup.confirmed).toBe(true);
  });

  it("returns confirmed=false and empty arrays when lineups key is absent", () => {
    const noLineups = { dates: [{ games: [{ gamePk: 778546 }] }] };
    const lineup = _mapLineup(noLineups, 778546);
    expect(lineup.home).toEqual([]);
    expect(lineup.away).toEqual([]);
    expect(lineup.confirmed).toBe(false);
  });

  it("returns confirmed=false and empty arrays for invalid payload", () => {
    const lineup = _mapLineup("garbage", 999);
    expect(lineup).toEqual({ gamePk: 999, home: [], away: [], confirmed: false });
  });

  it("skips players without id", () => {
    const partial = {
      dates: [
        {
          games: [
            {
              gamePk: 100,
              lineups: {
                homePlayers: [
                  { fullName: "Ghost Player" }, // no id
                  { id: 12345, fullName: "Real Player" },
                ],
                awayPlayers: [],
              },
            },
          ],
        },
      ],
    };
    const lineup = _mapLineup(partial, 100);
    expect(lineup.home).toHaveLength(1);
    expect(lineup.home[0].playerId).toBe(12345);
  });

  it("defaults name to empty string when fullName is missing", () => {
    const payload = {
      dates: [
        {
          games: [{ gamePk: 100, lineups: { homePlayers: [{ id: 1 }], awayPlayers: [] } }],
        },
      ],
    };
    const lineup = _mapLineup(payload, 100);
    expect(lineup.home[0].name).toBe("");
  });
});

// ---------------------------------------------------------------------------
// _mapPitcherSeason
// ---------------------------------------------------------------------------
describe("_mapPitcherSeason", () => {
  const seasonPayload = {
    stats: [
      {
        splits: [
          {
            season: "2025",
            stat: {
              gamesStarted: 31,
              gamesPlayed: 31,
              inningsPitched: "195.1",
              battersFaced: 750,
              strikeOuts: 241,
              strikeoutsPer9Inn: "11.10",
              strikePercentage: ".650",
              numberOfPitches: 2849,
            },
          },
        ],
      },
    ],
  };

  it("maps basic pitcher season stats", () => {
    const result = _mapPitcherSeason(seasonPayload, 669373, 2025);
    expect(result).toBeDefined();
    expect(result!.playerId).toBe(669373);
    expect(result!.season).toBe(2025);
    expect(result!.gamesStarted).toBe(31);
    expect(result!.gamesPlayed).toBe(31);
    expect(result!.strikeouts).toBe(241);
    expect(result!.numberOfPitches).toBe(2849);
  });

  it("parses inningsPitched from string to float", () => {
    const result = _mapPitcherSeason(seasonPayload, 669373, 2025)!;
    expect(result.inningsPitched).toBe(195.1);
  });

  it("computes kPct = strikeouts / battersFaced", () => {
    const result = _mapPitcherSeason(seasonPayload, 669373, 2025)!;
    expect(result.kPct).toBeCloseTo(241 / 750, 5);
  });

  it("returns kPct = 0 when battersFaced is 0", () => {
    const zeroBF = {
      stats: [{ splits: [{ stat: { battersFaced: 0, strikeOuts: 0, inningsPitched: "0.0" } }] }],
    };
    const result = _mapPitcherSeason(zeroBF, 1, 2025)!;
    expect(result.kPct).toBe(0);
  });

  it("parses kPer9 from strikeoutsPer9Inn", () => {
    const result = _mapPitcherSeason(seasonPayload, 669373, 2025)!;
    expect(result.kPer9).toBe(11.10);
  });

  it("parses strikePct from strikePercentage ('.650' -> 0.65)", () => {
    const result = _mapPitcherSeason(seasonPayload, 669373, 2025)!;
    expect(result.strikePct).toBe(0.65);
  });

  it("returns undefined for empty stats", () => {
    expect(_mapPitcherSeason({}, 1, 2025)).toBeUndefined();
  });

  it("returns undefined for stats with no splits", () => {
    expect(_mapPitcherSeason({ stats: [{ splits: [] }] }, 1, 2025)).toBeUndefined();
  });

  it("returns undefined for stats with empty split stat", () => {
    expect(_mapPitcherSeason({ stats: [{ splits: [{}] }] }, 1, 2025)).toBeUndefined();
  });

  it("prefers combined split for traded pitcher", () => {
    const traded = {
      stats: [
        {
          splits: [
            { numTeams: 1, team: { id: 116 }, stat: { strikeOuts: 50, battersFaced: 200, inningsPitched: "45.0" } },
            { numTeams: 2, stat: { strikeOuts: 120, battersFaced: 500, inningsPitched: "110.0" } },
          ],
        },
      ],
    };
    const result = _mapPitcherSeason(traded, 1, 2025)!;
    expect(result.strikeouts).toBe(120);
    expect(result.battersFaced).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// _mapGameLogs
// ---------------------------------------------------------------------------
describe("_mapGameLogs", () => {
  const gameLogPayload = {
    stats: [
      {
        splits: [
          {
            date: "2025-06-15",
            isHome: true,
            game: { gamePk: 778601 },
            opponent: { name: "Cleveland Guardians" },
            stat: {
              gamesStarted: 1,
              inningsPitched: "7.0",
              battersFaced: 25,
              strikeOuts: 10,
              numberOfPitches: 98,
            },
          },
          {
            date: "2025-06-10",
            isHome: false,
            game: { gamePk: 778590 },
            opponent: { name: "Chicago White Sox" },
            stat: {
              gamesStarted: 0, // relief appearance — should be filtered out
              inningsPitched: "1.0",
              battersFaced: 4,
              strikeOuts: 2,
            },
          },
          {
            date: "2025-06-05",
            isHome: true,
            game: { gamePk: 778580 },
            opponent: { name: "Minnesota Twins" },
            stat: {
              gamesStarted: 1,
              inningsPitched: "6.1",
              battersFaced: 23,
              strikeOuts: 8,
              numberOfPitches: 91,
            },
          },
          {
            date: "2025-05-30",
            isHome: false,
            game: { gamePk: 778570 },
            stat: {
              gamesStarted: 1,
              inningsPitched: "5.0",
              battersFaced: 20,
              strikeOuts: 6,
            },
          },
        ],
      },
    ],
  };

  it("filters to starts only (gamesStarted === 1)", () => {
    const logs = _mapGameLogs(gameLogPayload, 10);
    expect(logs).toHaveLength(3); // relief appearance excluded
    expect(logs.every((l) => l.gamesStarted === 1)).toBe(true);
  });

  it("sorts newest first by date", () => {
    const logs = _mapGameLogs(gameLogPayload, 10);
    expect(logs[0].date).toBe("2025-06-15");
    expect(logs[1].date).toBe("2025-06-05");
    expect(logs[2].date).toBe("2025-05-30");
  });

  it("caps results at n", () => {
    const logs = _mapGameLogs(gameLogPayload, 2);
    expect(logs).toHaveLength(2);
    expect(logs[0].date).toBe("2025-06-15");
    expect(logs[1].date).toBe("2025-06-05");
  });

  it("maps fields correctly", () => {
    const logs = _mapGameLogs(gameLogPayload, 1);
    const log = logs[0];
    expect(log.gamePk).toBe(778601);
    expect(log.isHome).toBe(true);
    expect(log.opponentName).toBe("Cleveland Guardians");
    expect(log.inningsPitched).toBe(7);
    expect(log.battersFaced).toBe(25);
    expect(log.strikeouts).toBe(10);
    expect(log.pitches).toBe(98);
  });

  it("handles missing numberOfPitches as undefined", () => {
    const logs = _mapGameLogs(gameLogPayload, 10);
    const noCount = logs.find((l) => l.date === "2025-05-30");
    expect(noCount?.pitches).toBeUndefined();
  });

  it("handles missing opponent name as undefined", () => {
    const logs = _mapGameLogs(gameLogPayload, 10);
    const noOpp = logs.find((l) => l.date === "2025-05-30");
    expect(noOpp?.opponentName).toBeUndefined();
  });

  it("returns empty array for invalid payload", () => {
    expect(_mapGameLogs("garbage", 10)).toEqual([]);
  });

  it("returns empty array for stats with no splits", () => {
    expect(_mapGameLogs({ stats: [{ splits: [] }] }, 10)).toEqual([]);
  });

  it("defaults gamePk to 0 when game.gamePk is missing", () => {
    const noGamePk = {
      stats: [
        {
          splits: [
            {
              date: "2025-06-15",
              stat: { gamesStarted: 1, inningsPitched: "6.0", battersFaced: 20, strikeOuts: 5 },
            },
          ],
        },
      ],
    };
    const logs = _mapGameLogs(noGamePk, 10);
    expect(logs[0].gamePk).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// _mapPlayerHands
// ---------------------------------------------------------------------------
describe("_mapPlayerHands", () => {
  const peoplePayload = {
    people: [
      { id: 669373, pitchHand: { code: "L" }, batSide: { code: "L" } },
      { id: 660271, pitchHand: { code: "R" }, batSide: { code: "S" } },
      { id: 543037, pitchHand: { code: "L" }, batSide: { code: "R" } },
    ],
  };

  it("maps pitchHand.code to throws", () => {
    const map = _mapPlayerHands(peoplePayload);
    expect(map.get(669373)?.throws).toBe("L");
    expect(map.get(660271)?.throws).toBe("R");
  });

  it("maps batSide.code to bats (including switch S)", () => {
    const map = _mapPlayerHands(peoplePayload);
    expect(map.get(669373)?.bats).toBe("L");
    expect(map.get(660271)?.bats).toBe("S");
    expect(map.get(543037)?.bats).toBe("R");
  });

  it("maps invalid pitchHand/batSide codes to undefined", () => {
    const invalid = { people: [{ id: 1, pitchHand: { code: "X" }, batSide: { code: "B" } }] };
    const map = _mapPlayerHands(invalid);
    expect(map.get(1)?.throws).toBeUndefined();
    expect(map.get(1)?.bats).toBeUndefined();
  });

  it("handles missing pitchHand/batSide objects", () => {
    const minimal = { people: [{ id: 2 }] };
    const map = _mapPlayerHands(minimal);
    expect(map.get(2)).toEqual({ throws: undefined, bats: undefined });
  });

  it("skips people without id", () => {
    const noId = { people: [{ pitchHand: { code: "L" } }] };
    const map = _mapPlayerHands(noId);
    expect(map.size).toBe(0);
  });

  it("returns empty map for invalid payload", () => {
    const map = _mapPlayerHands("garbage");
    expect(map.size).toBe(0);
  });

  it("returns empty map for empty people array", () => {
    const map = _mapPlayerHands({ people: [] });
    expect(map.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// _mapBatterKSplits
// ---------------------------------------------------------------------------
describe("_mapBatterKSplits", () => {
  const splitsPayload = {
    stats: [
      {
        splits: [
          {
            split: { code: "vl", description: "vs Left" },
            stat: { strikeOuts: 67, plateAppearances: 244 },
          },
          {
            split: { code: "vr", description: "vs Right" },
            stat: { strikeOuts: 120, plateAppearances: 483 },
          },
        ],
      },
    ],
  };

  it("computes kPctVsL = strikeOuts / plateAppearances for vl", () => {
    const result = _mapBatterKSplits(splitsPayload, 660271, 2025)!;
    expect(result.kPctVsL).toBeCloseTo(67 / 244, 5);
  });

  it("computes kPctVsR = strikeOuts / plateAppearances for vr", () => {
    const result = _mapBatterKSplits(splitsPayload, 660271, 2025)!;
    expect(result.kPctVsR).toBeCloseTo(120 / 483, 5);
  });

  it("captures PA for confidence weighting", () => {
    const result = _mapBatterKSplits(splitsPayload, 660271, 2025)!;
    expect(result.paVsL).toBe(244);
    expect(result.paVsR).toBe(483);
  });

  it("sets playerId and season", () => {
    const result = _mapBatterKSplits(splitsPayload, 660271, 2025)!;
    expect(result.playerId).toBe(660271);
    expect(result.season).toBe(2025);
  });

  it("returns undefined when no splits exist", () => {
    expect(_mapBatterKSplits({ stats: [{ splits: [] }] }, 1, 2025)).toBeUndefined();
  });

  it("returns undefined for empty payload", () => {
    expect(_mapBatterKSplits({}, 1, 2025)).toBeUndefined();
  });

  it("returns undefined for invalid payload", () => {
    expect(_mapBatterKSplits("garbage", 1, 2025)).toBeUndefined();
  });

  it("handles division-by-zero: PA=0 -> kPct undefined", () => {
    const zeroPA = {
      stats: [
        {
          splits: [
            { split: { code: "vl" }, stat: { strikeOuts: 0, plateAppearances: 0 } },
            { split: { code: "vr" }, stat: { strikeOuts: 5, plateAppearances: 100 } },
          ],
        },
      ],
    };
    const result = _mapBatterKSplits(zeroPA, 1, 2025)!;
    expect(result.kPctVsL).toBeUndefined();
    expect(result.kPctVsR).toBeCloseTo(0.05, 5);
  });

  it("handles only one side present (vl only)", () => {
    const oneHand = {
      stats: [
        {
          splits: [{ split: { code: "vl" }, stat: { strikeOuts: 30, plateAppearances: 100 } }],
        },
      ],
    };
    const result = _mapBatterKSplits(oneHand, 1, 2025)!;
    expect(result.kPctVsL).toBeCloseTo(0.3, 5);
    expect(result.kPctVsR).toBeUndefined();
    expect(result.paVsR).toBeUndefined();
  });

  it("prefers combined split for traded batter", () => {
    const traded = {
      stats: [
        {
          splits: [
            // per-team vl
            { split: { code: "vl" }, numTeams: 1, team: { id: 116 }, stat: { strikeOuts: 10, plateAppearances: 50 } },
            // combined vl
            { split: { code: "vl" }, numTeams: 2, stat: { strikeOuts: 25, plateAppearances: 100 } },
            { split: { code: "vr" }, stat: { strikeOuts: 40, plateAppearances: 200 } },
          ],
        },
      ],
    };
    const result = _mapBatterKSplits(traded, 1, 2025)!;
    expect(result.kPctVsL).toBeCloseTo(0.25, 5);
    expect(result.paVsL).toBe(100);
  });
});
