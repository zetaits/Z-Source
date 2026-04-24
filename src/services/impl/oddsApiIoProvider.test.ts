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
  return createOddsApiIoProvider(() => ({ apiKey: "test-key", sportSlug: "football" }));
};

beforeEach(async () => {
  (await loadHttp()).mockReset();
});

describe("createOddsApiIoProvider", () => {
  it("maps ML_1X2 outcomes into selections", async () => {
    (await loadHttp()).mockResolvedValue(
      mockResponse({
        id: "evt-1",
        home_team: "Arsenal",
        away_team: "Chelsea",
        bookmakers: [
          {
            key: "pinnacle",
            title: "Pinnacle",
            last_update: "2026-04-17T12:00:00Z",
            markets: [
              {
                key: "h2h",
                outcomes: [
                  { name: "Arsenal", price: 2.1 },
                  { name: "Draw", price: 3.5 },
                  { name: "Chelsea", price: 3.8 },
                ],
              },
            ],
          },
        ],
      }),
    );

    const provider = await loadProvider();
    const snaps = await provider.getOdds("evt-1" as MatchId, ["ML_1X2"]);
    expect(snaps).toHaveLength(1);
    const sides = snaps[0].offers.map((o) => o.selection.side).sort();
    expect(sides).toEqual(["away", "draw", "home"]);
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
    (await loadHttp()).mockResolvedValue(mockResponse({ not: "expected" }));
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
