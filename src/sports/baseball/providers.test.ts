import { describe, expect, it } from "vitest";
import { _mlbScheduleSchema, _mlbToCatalogMatch } from "./providers";

const sampleSchedule = {
  dates: [
    {
      date: "2026-06-18",
      games: [
        {
          gamePk: 745804,
          gameDate: "2026-06-18T23:05:00Z",
          status: { abstractGameState: "Preview", detailedState: "Scheduled" },
          teams: {
            home: { team: { id: 147, name: "New York Yankees" } },
            away: { team: { id: 111, name: "Boston Red Sox" } },
          },
        },
        {
          gamePk: 745805,
          gameDate: "2026-06-18T20:10:00Z",
          status: { abstractGameState: "Preview", detailedState: "Postponed" },
          teams: {
            home: { team: { id: 119, name: "Los Angeles Dodgers" } },
            away: { team: { id: 137, name: "San Francisco Giants" } },
          },
        },
      ],
    },
  ],
};

describe("mlb statsapi catalog mapping", () => {
  it("parses a schedule payload", () => {
    const parsed = _mlbScheduleSchema.safeParse(sampleSchedule);
    expect(parsed.success).toBe(true);
  });

  it("maps a game to a CatalogMatch", () => {
    const game = sampleSchedule.dates[0].games[0];
    const m = _mlbToCatalogMatch(game)!;
    expect(m.catalogId).toBe("745804");
    expect(m.source).toBe("mlb-statsapi");
    expect(m.leagueName).toBe("MLB");
    expect(m.home.name).toBe("New York Yankees");
    expect(m.away.name).toBe("Boston Red Sox");
    expect(m.status).toBe("SCHEDULED");
    expect(m.kickoffAt).toBe("2026-06-18T23:05:00Z");
  });

  it("maps postponed detailedState to POSTPONED", () => {
    const game = sampleSchedule.dates[0].games[1];
    expect(_mlbToCatalogMatch(game)!.status).toBe("POSTPONED");
  });

  it("returns null when team names are missing", () => {
    expect(_mlbToCatalogMatch({ gamePk: 1, gameDate: "x", teams: {} })).toBeNull();
  });
});
