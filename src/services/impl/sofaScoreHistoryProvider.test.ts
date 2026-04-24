import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MatchId, TeamId } from "@/domain/ids";
import { createSofaScoreHistoryProvider } from "./sofaScoreHistoryProvider";

vi.mock("@/services/http/httpClient", () => ({
  httpRequest: vi.fn(),
}));

vi.mock("@/storage/repos/historyCacheRepo", async () => {
  const cacheMap = new Map<string, { payload: unknown; fetchedAt: string }>();
  return {
    historyCacheRepo: {
      get: vi.fn(async (key: string) => {
        const row = cacheMap.get(key);
        return row ? { cacheKey: key, ...row } : null;
      }),
      upsert: vi.fn(async (row: { cacheKey: string; payload: unknown; fetchedAt: string }) => {
        cacheMap.set(row.cacheKey, { payload: row.payload, fetchedAt: row.fetchedAt });
      }),
      evictOlderThan: vi.fn(async () => 0),
    },
    formCacheKey: (teamId: number, lastN: number) => `form:${teamId}:${lastN}`,
    h2hCacheKey: (a: number, b: number) => {
      const [x, y] = [a, b].sort((p, q) => p - q);
      return `h2h:${x}:${y}`;
    },
    intangiblesCacheKey: (matchId: string) => `intangibles:${matchId}`,
    __cacheMap: cacheMap,
  };
});

const { httpRequest } = await import("@/services/http/httpClient");
const mockHttp = httpRequest as ReturnType<typeof vi.fn>;
const cacheMod = (await import("@/storage/repos/historyCacheRepo")) as unknown as {
  __cacheMap: Map<string, unknown>;
};

const okJson = (data: unknown) => ({
  status: 200,
  headers: new Headers(),
  ok: true,
  url: "",
  text: async () => JSON.stringify(data),
  json: async () => data,
});

const finishedEvent = (
  overrides: {
    id?: number;
    startTimestamp?: number;
    homeId?: number;
    homeName?: string;
    awayId?: number;
    awayName?: string;
    homeScore?: number;
    awayScore?: number;
  } = {},
) => ({
  id: overrides.id ?? 1,
  startTimestamp: overrides.startTimestamp ?? 1700000000,
  status: { code: 100, type: "finished" },
  homeTeam: { id: overrides.homeId ?? 10, name: overrides.homeName ?? "Home" },
  awayTeam: { id: overrides.awayId ?? 20, name: overrides.awayName ?? "Away" },
  homeScore: { current: overrides.homeScore ?? 1 },
  awayScore: { current: overrides.awayScore ?? 0 },
});

beforeEach(() => {
  mockHttp.mockReset();
  cacheMod.__cacheMap.clear();
});

describe("sofaScoreHistoryProvider.getForm", () => {
  it("returns empty form when sofaScoreTeamId missing", async () => {
    const p = createSofaScoreHistoryProvider();
    const form = await p.getForm("t1" as TeamId, 5);
    expect(form.games).toEqual([]);
    expect(form.ppgLast).toBe(0);
    expect(mockHttp).not.toHaveBeenCalled();
  });

  it("maps finished events to games with correct W/L/D", async () => {
    mockHttp.mockResolvedValueOnce(
      okJson({
        events: [
          finishedEvent({ id: 1, homeId: 10, awayId: 99, homeScore: 2, awayScore: 1 }), // W as home
          finishedEvent({ id: 2, homeId: 88, awayId: 10, homeScore: 3, awayScore: 0 }), // L as away
          finishedEvent({ id: 3, homeId: 10, awayId: 77, homeScore: 1, awayScore: 1 }), // D as home
        ],
      }),
    );
    const p = createSofaScoreHistoryProvider();
    const form = await p.getForm("t1" as TeamId, 3, { sofaScoreTeamId: 10 });
    expect(form.games).toHaveLength(3);
    expect(form.games.map((g) => g.result)).toEqual(["W", "L", "D"]);
    expect(form.goalsFor).toBe(3);
    expect(form.goalsAgainst).toBe(5);
    expect(form.ppgLast).toBeCloseTo((3 + 0 + 1) / 3);
  });

  it("picks the most recent N games when events arrive ASC by timestamp", async () => {
    // SofaScore returns /team/{id}/events/last/0 in ASC order. Make sure
    // getForm sorts DESC so "last N" = N most-recent, not N oldest.
    mockHttp.mockResolvedValueOnce(
      okJson({
        events: [
          finishedEvent({ id: 1, homeId: 10, awayId: 91, startTimestamp: 1_000, homeScore: 1, awayScore: 0 }),
          finishedEvent({ id: 2, homeId: 92, awayId: 10, startTimestamp: 2_000, homeScore: 0, awayScore: 2 }),
          finishedEvent({ id: 3, homeId: 10, awayId: 93, startTimestamp: 3_000, homeScore: 3, awayScore: 0 }),
          finishedEvent({ id: 4, homeId: 94, awayId: 10, startTimestamp: 4_000, homeScore: 1, awayScore: 1 }),
          finishedEvent({ id: 5, homeId: 10, awayId: 95, startTimestamp: 5_000, homeScore: 4, awayScore: 1 }),
        ],
      }),
    );
    const p = createSofaScoreHistoryProvider();
    const form = await p.getForm("t1" as TeamId, 3, { sofaScoreTeamId: 10 });
    expect(form.games.map((g) => g.matchId)).toEqual(["5", "4", "3"]);
    expect(form.games[0].result).toBe("W");
  });

  it("skips unfinished events", async () => {
    mockHttp.mockResolvedValueOnce(
      okJson({
        events: [
          finishedEvent({ id: 1, homeId: 10 }),
          {
            id: 2,
            startTimestamp: 1800000000,
            status: { code: 0, type: "notstarted" },
            homeTeam: { id: 10, name: "Home" },
            awayTeam: { id: 99, name: "Away" },
          },
        ],
      }),
    );
    const p = createSofaScoreHistoryProvider();
    const form = await p.getForm("t1" as TeamId, 5, { sofaScoreTeamId: 10 });
    expect(form.games).toHaveLength(1);
  });
});

describe("sofaScoreHistoryProvider.getH2H", () => {
  it("returns empty H2H when missing ids", async () => {
    const p = createSofaScoreHistoryProvider();
    const h2h = await p.getH2H("h" as TeamId, "a" as TeamId);
    expect(h2h.meetings).toEqual([]);
    expect(mockHttp).not.toHaveBeenCalled();
  });

  it("aggregates wins/draws/losses from home perspective", async () => {
    mockHttp
      .mockResolvedValueOnce(
        okJson({
          events: [
            finishedEvent({ id: 1, homeId: 10, awayId: 20, homeScore: 2, awayScore: 0 }),
            finishedEvent({ id: 2, homeId: 20, awayId: 10, homeScore: 2, awayScore: 3 }),
            finishedEvent({ id: 3, homeId: 10, awayId: 20, homeScore: 1, awayScore: 1 }),
          ],
        }),
      )
      .mockResolvedValueOnce(okJson({ events: [] }))
      .mockResolvedValueOnce(okJson({ events: [] }))
      .mockResolvedValueOnce(okJson({ events: [] }))
      .mockResolvedValueOnce(okJson({ events: [] }))
      .mockResolvedValueOnce(okJson({ events: [] }));
    const p = createSofaScoreHistoryProvider();
    const h2h = await p.getH2H("h" as TeamId, "a" as TeamId, {
      homeSofaScoreId: 10,
      awaySofaScoreId: 20,
    });
    expect(h2h.meetings).toHaveLength(3);
    expect(h2h.homeWins).toBe(2);
    expect(h2h.draws).toBe(1);
    expect(h2h.awayWins).toBe(0);
    expect(h2h.averageGoals).toBeCloseTo(9 / 3);
  });

  it("dedupes meetings fetched from both teams", async () => {
    const shared = finishedEvent({ id: 42, homeId: 30, awayId: 40, homeScore: 1, awayScore: 0 });
    mockHttp
      .mockResolvedValueOnce(okJson({ events: [shared] }))
      .mockResolvedValueOnce(okJson({ events: [] }))
      .mockResolvedValueOnce(okJson({ events: [shared] }))
      .mockResolvedValueOnce(okJson({ events: [] }))
      .mockResolvedValueOnce(okJson({ events: [] }))
      .mockResolvedValueOnce(okJson({ events: [] }));
    const p = createSofaScoreHistoryProvider();
    const h2h = await p.getH2H("h" as TeamId, "a" as TeamId, {
      homeSofaScoreId: 30,
      awaySofaScoreId: 40,
    });
    expect(h2h.meetings).toHaveLength(1);
    expect(h2h.homeWins).toBe(1);
  });
});

describe("sofaScoreHistoryProvider.getIntangibles", () => {
  it("returns empty when missing ids", async () => {
    const p = createSofaScoreHistoryProvider();
    const res = await p.getIntangibles("m1" as MatchId);
    expect(res.homeRestDays).toBeUndefined();
    expect(res.homeInjuries).toEqual([]);
    expect(mockHttp).not.toHaveBeenCalled();
  });

  it("computes rest days + congestion from last/next events", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const threeDaysAgoSec = nowSec - 3 * 24 * 60 * 60;
    const inTwoDaysSec = nowSec + 2 * 24 * 60 * 60;
    const inTenDaysSec = nowSec + 10 * 24 * 60 * 60;

    mockHttp
      .mockResolvedValueOnce(
        okJson({
          events: [finishedEvent({ id: 1, homeId: 10, startTimestamp: threeDaysAgoSec })],
        }),
      )
      .mockResolvedValueOnce(
        okJson({
          events: [finishedEvent({ id: 2, homeId: 20, startTimestamp: threeDaysAgoSec })],
        }),
      )
      .mockResolvedValueOnce(
        okJson({
          events: [
            {
              id: 3,
              startTimestamp: inTwoDaysSec,
              status: { code: 0, type: "notstarted" },
              homeTeam: { id: 10, name: "a" },
              awayTeam: { id: 99, name: "b" },
            },
            {
              id: 4,
              startTimestamp: inTenDaysSec,
              status: { code: 0, type: "notstarted" },
              homeTeam: { id: 10, name: "a" },
              awayTeam: { id: 99, name: "b" },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(okJson({ events: [] }));

    const p = createSofaScoreHistoryProvider();
    const res = await p.getIntangibles("m1" as MatchId, {
      homeSofaScoreId: 10,
      awaySofaScoreId: 20,
    });
    expect(res.homeRestDays).toBe(3);
    expect(res.awayRestDays).toBe(3);
    expect(res.homeCongestion).toBe(1);
    expect(res.awayCongestion).toBe(0);
  });
});
