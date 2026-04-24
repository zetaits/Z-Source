import { describe, expect, it } from "vitest";
import {
  isFinishedEvent,
  readScore,
  sofaTeamEventsResponseSchema,
  teamEventsLastUrl,
  teamEventsNextUrl,
  teamInfoUrl,
} from "./sofaScore.v2";

describe("sofaScore.v2 urls", () => {
  it("builds team events last url", () => {
    expect(teamEventsLastUrl(42)).toBe(
      "https://api.sofascore.com/api/v1/team/42/events/last/0",
    );
  });
  it("builds team events next url", () => {
    expect(teamEventsNextUrl(42, 2)).toBe(
      "https://api.sofascore.com/api/v1/team/42/events/next/2",
    );
  });
  it("builds team info url", () => {
    expect(teamInfoUrl(42)).toBe("https://api.sofascore.com/api/v1/team/42");
  });
});

describe("readScore", () => {
  it("reads current score", () => {
    expect(readScore({ current: 2, display: 2 })).toBe(2);
  });
  it("falls back to display", () => {
    expect(readScore({ display: 1 })).toBe(1);
  });
  it("returns null when missing", () => {
    expect(readScore(undefined)).toBeNull();
    expect(readScore({})).toBeNull();
  });
});

describe("isFinishedEvent", () => {
  it("true for type=finished", () => {
    expect(
      isFinishedEvent({
        id: 1,
        startTimestamp: 0,
        status: { code: 100, type: "finished" },
        homeTeam: { id: 1, name: "a" },
        awayTeam: { id: 2, name: "b" },
      }),
    ).toBe(true);
  });
  it("false for type=notstarted", () => {
    expect(
      isFinishedEvent({
        id: 1,
        startTimestamp: 0,
        status: { code: 0, type: "notstarted" },
        homeTeam: { id: 1, name: "a" },
        awayTeam: { id: 2, name: "b" },
      }),
    ).toBe(false);
  });
});

describe("response schemas", () => {
  it("parses team events response", () => {
    const raw = {
      events: [
        {
          id: 1,
          startTimestamp: 1700000000,
          status: { code: 100, type: "finished" },
          homeTeam: { id: 1, name: "Arsenal" },
          awayTeam: { id: 2, name: "Chelsea" },
          homeScore: { current: 2, display: 2 },
          awayScore: { current: 1, display: 1 },
        },
      ],
      hasNextPage: false,
    };
    const parsed = sofaTeamEventsResponseSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });

});
