import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MatchId } from "@/domain/ids";
import { createActionNetworkSplitProvider } from "./actionNetworkSplitProvider";

vi.mock("@/services/http/httpClient", () => ({
  httpRequest: vi.fn(),
}));

vi.mock("@/storage/repos/splitsCacheRepo", async () => {
  const map = new Map<string, unknown>();
  return {
    splitsCacheRepo: {
      get: vi.fn(async (matchId: string, market: string, providerId: string) => {
        const row = map.get(`${matchId}|${market}|${providerId}`);
        return row ?? null;
      }),
      upsert: vi.fn(async (row: { matchId: string; marketKey: string; providerId: string }) => {
        map.set(`${row.matchId}|${row.marketKey}|${row.providerId}`, row);
      }),
    },
    __map: map,
  };
});

const { httpRequest } = await import("@/services/http/httpClient");
const mockHttp = httpRequest as ReturnType<typeof vi.fn>;
const cacheMod = (await import("@/storage/repos/splitsCacheRepo")) as unknown as {
  __map: Map<string, unknown>;
};

const okJson = (data: unknown) => ({
  status: 200,
  headers: new Headers(),
  ok: true,
  url: "",
  text: async () => JSON.stringify(data),
  json: async () => data,
});

interface FixtureOpts {
  homeId?: number;
  awayId?: number;
  homeName?: string;
  awayName?: string;
  homeBets?: number;
  homeMoney?: number;
  awayBets?: number;
  awayMoney?: number;
  drawBets?: number;
  drawMoney?: number;
}

const gameFixture = (overrides?: FixtureOpts) => {
  const {
    homeId = 10,
    awayId = 20,
    homeName = "Valencia",
    awayName = "Mallorca",
    homeBets = 55,
    homeMoney = 60,
    awayBets = 35,
    awayMoney = 30,
    drawBets = 10,
    drawMoney = 10,
  } = overrides ?? {};
  return {
    id: 1,
    league_id: 12,
    league_name: "laliga",
    start_time: "2026-04-21T17:00:00.000Z",
    home_team_id: homeId,
    away_team_id: awayId,
    teams: [
      { id: homeId, full_name: homeName },
      { id: awayId, full_name: awayName },
    ],
    markets: {
      "15": {
        event: {
          moneyline: [
            {
              type: "moneyline",
              side: "home",
              team_id: homeId,
              odds: 150,
              bet_info: {
                tickets: { value: 550, percent: homeBets },
                money: { value: 6000, percent: homeMoney },
              },
            },
            {
              type: "moneyline",
              side: "draw",
              team_id: 0,
              odds: 250,
              bet_info: {
                tickets: { value: 100, percent: drawBets },
                money: { value: 1000, percent: drawMoney },
              },
            },
            {
              type: "moneyline",
              side: "away",
              team_id: awayId,
              odds: 250,
              bet_info: {
                tickets: { value: 350, percent: awayBets },
                money: { value: 3000, percent: awayMoney },
              },
            },
          ],
        },
      },
    },
  };
};

beforeEach(() => {
  mockHttp.mockReset();
  cacheMod.__map.clear();
});

describe("actionNetworkSplitProvider", () => {
  it("returns null without matchContext", async () => {
    const p = createActionNetworkSplitProvider();
    const res = await p.getSplits("m1" as MatchId, ["ML_1X2"]);
    expect(res).toBeNull();
    expect(mockHttp).not.toHaveBeenCalled();
  });

  it("maps home/draw/away moneyline percentages (3-way)", async () => {
    mockHttp.mockResolvedValueOnce(okJson({ games: [gameFixture()] }));
    const p = createActionNetworkSplitProvider();
    const res = await p.getSplits("m1" as MatchId, ["ML_1X2"], {
      matchContext: {
        homeName: "Valencia",
        awayName: "Mallorca",
        kickoffAt: "2026-04-21T17:00:00.000Z",
      },
    });
    expect(res).toHaveLength(1);
    const rows = res![0].rows;
    expect(rows.map((r) => r.selection.side)).toEqual(["home", "draw", "away"]);
    const betsSum = rows.reduce((a, r) => a + (r.betsPct ?? 0), 0);
    const moneySum = rows.reduce((a, r) => a + (r.moneyPct ?? 0), 0);
    expect(betsSum).toBe(100);
    expect(moneySum).toBe(100);
    const draw = rows.find((r) => r.selection.side === "draw")!;
    expect(draw.betsPct).toBe(10);
    expect(draw.moneyPct).toBe(10);
  });

  it("picks correct game among multiple candidates", async () => {
    mockHttp.mockResolvedValueOnce(
      okJson({
        games: [
          gameFixture({ homeId: 1, awayId: 2, homeName: "Real Betis", awayName: "Sevilla" }),
          gameFixture({ homeId: 10, awayId: 20, homeName: "Valencia", awayName: "Mallorca" }),
        ],
      }),
    );
    const p = createActionNetworkSplitProvider();
    const res = await p.getSplits("m1" as MatchId, ["ML_1X2"], {
      matchContext: {
        homeName: "Valencia",
        awayName: "Mallorca",
        kickoffAt: "2026-04-21T17:00:00.000Z",
      },
    });
    expect(res).toHaveLength(1);
    expect(res![0].matchId).toBe("m1");
  });

  it("returns null when no fuzzy candidate passes threshold", async () => {
    mockHttp.mockResolvedValueOnce(
      okJson({
        games: [gameFixture({ homeName: "Arsenal", awayName: "Chelsea" })],
      }),
    );
    const p = createActionNetworkSplitProvider();
    const res = await p.getSplits("m1" as MatchId, ["ML_1X2"], {
      matchContext: {
        homeName: "Valencia",
        awayName: "Mallorca",
        kickoffAt: "2026-04-21T17:00:00.000Z",
      },
    });
    expect(res).toBeNull();
  });

  it("skips books without populated bet_info, falls through to next", async () => {
    mockHttp.mockResolvedValueOnce(
      okJson({
        games: [
          {
            id: 2,
            home_team_id: 10,
            away_team_id: 20,
            teams: [
              { id: 10, full_name: "Valencia" },
              { id: 20, full_name: "Mallorca" },
            ],
            markets: {
              "30": {
                event: {
                  moneyline: [
                    { type: "moneyline", side: "home", team_id: 10, odds: 150 },
                    { type: "moneyline", side: "away", team_id: 20, odds: 250 },
                  ],
                },
              },
              "15": gameFixture().markets["15"],
            },
          },
        ],
      }),
    );
    const p = createActionNetworkSplitProvider();
    const res = await p.getSplits("m1" as MatchId, ["ML_1X2"], {
      matchContext: {
        homeName: "Valencia",
        awayName: "Mallorca",
        kickoffAt: "2026-04-21T17:00:00.000Z",
      },
    });
    expect(res).toHaveLength(1);
    const home = res![0].rows.find((r) => r.selection.side === "home")!;
    expect(home.betsPct).toBe(55);
    expect(home.moneyPct).toBe(60);
  });

  it("returns empty array for unsupported markets", async () => {
    const p = createActionNetworkSplitProvider();
    const res = await p.getSplits("m1" as MatchId, ["AH"], {
      matchContext: {
        homeName: "Valencia",
        awayName: "Mallorca",
        kickoffAt: "2026-04-21T17:00:00.000Z",
      },
    });
    expect(res).toEqual([]);
    expect(mockHttp).not.toHaveBeenCalled();
  });
});
