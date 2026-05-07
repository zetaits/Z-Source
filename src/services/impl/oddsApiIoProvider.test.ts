import { beforeEach, describe, expect, it, vi } from "vitest";
import { MatchId } from "@/domain/ids";
import { HttpError } from "@/services/http/httpClient";

vi.mock("@/services/http/httpClient", async () => {
  const actual =
    await vi.importActual<typeof import("@/services/http/httpClient")>(
      "@/services/http/httpClient",
    );
  return {
    ...actual,
    httpRequest: vi.fn(),
  };
});

vi.mock("@/services/http/quotaTracker", async () => {
  const actual =
    await vi.importActual<typeof import("@/services/http/quotaTracker")>(
      "@/services/http/quotaTracker",
    );
  return {
    ...actual,
    oddsApiIoQuota: {
      ...actual.oddsApiIoQuota,
      observeHeaders: vi.fn(),
      recordRequest: vi.fn(),
      snapshot: () => ({
        remaining: null,
        used: null,
        resetAt: null,
        lastSyncedAt: null,
      }),
    },
  };
});

const mockResponse = (json: unknown) => ({
  status: 200,
  headers: new Headers(),
  ok: true,
  url: "https://api.odds-api.io/v3/odds",
  text: async () => JSON.stringify(json),
  json: async () => json,
});

const loadHttp = async () => {
  const mod = await import("@/services/http/httpClient");
  return mod.httpRequest as unknown as ReturnType<typeof vi.fn>;
};

const loadProvider = async () => {
  const { createOddsApiIoProvider } = await import("./oddsApiIoProvider");
  return createOddsApiIoProvider(() => ({
    apiKey: "test-key",
    sportSlug: "football",
    bookmakers: ["bet365", "sbobet"],
  }));
};

beforeEach(async () => {
  (await loadHttp()).mockReset();
});

describe("createOddsApiIoProvider", () => {
  it("maps ML_1X2 outcomes into selections", async () => {
    (await loadHttp()).mockResolvedValue(
      mockResponse({
        id: 12345,
        home: "Arsenal",
        away: "Chelsea",
        date: "2026-04-17T15:00:00Z",
        bookmakers: {
          Bet365: [
            { name: "ML", odds: [{ home: 2.1, draw: 3.5, away: 3.8 }], updatedAt: "2026-04-17T14:00:00Z" },
          ],
          Sbobet: [
            { name: "ML", odds: [{ home: 2.05, draw: 3.6, away: 3.75 }], updatedAt: "2026-04-17T14:00:00Z" },
          ],
        },
      }),
    );

    const provider = await loadProvider();
    const snaps = await provider.getOdds("12345" as MatchId, ["ML_1X2"]);
    expect(snaps).toHaveLength(1);
    const sides = snaps[0].offers.map((o) => o.selection.side).sort();
    expect(sides).toEqual(["away", "away", "draw", "draw", "home", "home"]);
  });

  it("maps OU_GOALS outcomes into over/under selections", async () => {
    (await loadHttp()).mockResolvedValue(
      mockResponse({
        id: 12345,
        home: "Arsenal",
        away: "Chelsea",
        date: "2026-04-17T15:00:00Z",
        bookmakers: {
          Bet365: [
            { name: "Totals", odds: [{ hdp: 2.5, over: 1.85, under: 1.95 }], updatedAt: "2026-04-17T14:00:00Z" },
          ],
        },
      }),
    );

    const provider = await loadProvider();
    const snaps = await provider.getOdds("12345" as MatchId, ["OU_GOALS"]);
    expect(snaps).toHaveLength(1);
    const sides = snaps[0].offers.map((o) => o.selection.side).sort();
    expect(sides).toEqual(["over", "under"]);
    const overOffer = snaps[0].offers.find((o) => o.selection.side === "over");
    expect((overOffer?.selection as { line?: number }).line).toBe(2.5);
  });

  it("maps BTTS yes/no fields into selections", async () => {
    (await loadHttp()).mockResolvedValue(
      mockResponse({
        id: 12345,
        home: "Bayern Munich",
        away: "Paris Saint-Germain",
        date: "2026-05-06T19:00:00Z",
        bookmakers: {
          Bet365: [
            { name: "Both Teams To Score", odds: [{ yes: "1.300", no: "3.400" }], updatedAt: "2026-05-06T15:03:19.866Z" },
          ],
        },
      }),
    );

    const provider = await loadProvider();
    const snaps = await provider.getOdds("12345" as MatchId, ["BTTS"]);
    expect(snaps).toHaveLength(1);
    const sides = snaps[0].offers.map((o) => o.selection.side).sort();
    expect(sides).toEqual(["no", "yes"]);
    const yesOffer = snaps[0].offers.find((o) => o.selection.side === "yes");
    expect(yesOffer?.decimal).toBe(1.3);
  });

  it("maps Goals Over/Under name to OU_GOALS", async () => {
    (await loadHttp()).mockResolvedValue(
      mockResponse({
        id: 12345,
        home: "Bayern Munich",
        away: "Paris Saint-Germain",
        date: "2026-05-06T19:00:00Z",
        bookmakers: {
          Bet365: [
            { name: "Goals Over/Under", odds: [{ hdp: 2.5, over: "1.222", under: "4.333" }], updatedAt: "2026-05-06T15:03:19.866Z" },
          ],
        },
      }),
    );

    const provider = await loadProvider();
    const snaps = await provider.getOdds("12345" as MatchId, ["OU_GOALS"]);
    expect(snaps).toHaveLength(1);
    const sides = snaps[0].offers.map((o) => o.selection.side).sort();
    expect(sides).toEqual(["over", "under"]);
  });

  it("maps listEvents using id/home/away/date fields", async () => {
    (await loadHttp()).mockResolvedValue(
      mockResponse([
        {
          id: 99,
          home: "Real Madrid",
          away: "Barcelona",
          date: "2026-05-10T20:00:00Z",
        },
        {
          id: 100,
          home: "Atletico",
          away: "Sevilla",
          date: "2026-05-10T18:00:00Z",
        },
      ]),
    );

    const provider = await loadProvider();
    const events = await provider.listEvents("football");
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      eventId: "99",
      homeName: "Real Madrid",
      awayName: "Barcelona",
      kickoffAt: "2026-05-10T20:00:00Z",
    });
  });

  it("filters out listEvents entries missing required fields", async () => {
    (await loadHttp()).mockResolvedValue(
      mockResponse([
        { id: 1, home: "Arsenal", away: "Chelsea" }, // missing date
        { home: "Liverpool", away: "City", date: "2026-05-10T20:00:00Z" }, // missing id
        { id: 3, home: "PSG", away: "Lyon", date: "2026-05-11T20:00:00Z" }, // valid
      ]),
    );

    const provider = await loadProvider();
    const events = await provider.listEvents("football");
    expect(events).toHaveLength(1);
    expect(events[0].eventId).toBe("3");
  });

  it("throws configured message on 401", async () => {
    (await loadHttp()).mockRejectedValue(new HttpError(401, "x", ""));
    const provider = await loadProvider();
    await expect(
      provider.getOdds("evt" as MatchId, ["ML_1X2"]),
    ).rejects.toThrow(/rejected the API key/);
  });

  it("throws rate-limit message on 429", async () => {
    (await loadHttp()).mockRejectedValue(new HttpError(429, "x", ""));
    const provider = await loadProvider();
    await expect(
      provider.getOdds("evt" as MatchId, ["ML_1X2"]),
    ).rejects.toThrow(/rate limit/);
  });

  it("returns empty array when zod parse fails", async () => {
    (await loadHttp()).mockResolvedValue(mockResponse("not-an-object"));
    const provider = await loadProvider();
    const snaps = await provider.getOdds("evt" as MatchId, ["ML_1X2"]);
    expect(snaps).toEqual([]);
  });

  it("returns empty when provider key is missing", async () => {
    const { createOddsApiIoProvider } = await import("./oddsApiIoProvider");
    const provider = createOddsApiIoProvider(() => ({ apiKey: "", sportSlug: "football" }));
    await expect(provider.getOdds("evt" as MatchId, ["ML_1X2"])).rejects.toThrow(
      /not configured/,
    );
  });
});
