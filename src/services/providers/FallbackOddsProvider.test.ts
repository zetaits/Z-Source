import { describe, expect, it, vi } from "vitest";
import { MatchId } from "@/domain/ids";
import type { LineSnapshot } from "@/domain/odds";
import type { OddsProvider, ProviderEvent } from "./OddsProvider";
import { createFallbackOddsProvider } from "./FallbackOddsProvider";

const stub = (overrides: Partial<OddsProvider>): OddsProvider => ({
  name: "stub",
  async getOdds() {
    return [];
  },
  async snapshotOpeners() {
    return [];
  },
  async listEvents(): Promise<ProviderEvent[]> {
    return [];
  },
  quota: () => ({ remaining: null, used: null, resetAt: null, lastSyncedAt: null }),
  ...overrides,
});

const snap = (id: string): LineSnapshot => ({
  matchId: id as MatchId,
  marketKey: "ML_1X2",
  offers: [],
  takenAt: new Date().toISOString(),
});

describe("FallbackOddsProvider", () => {
  it("returns first provider result when not empty", async () => {
    const a = stub({ name: "a", getOdds: vi.fn().mockResolvedValue([snap("ev-a")]) });
    const b = stub({ name: "b", getOdds: vi.fn().mockResolvedValue([snap("ev-b")]) });
    const fb = createFallbackOddsProvider([a, b]);
    const res = await fb.getOdds("m" as MatchId, ["ML_1X2"]);
    expect(res).toHaveLength(1);
    expect(res[0].matchId).toBe("ev-a");
    expect(b.getOdds).not.toHaveBeenCalled();
  });

  it("falls back when first returns empty", async () => {
    const a = stub({ name: "a", getOdds: vi.fn().mockResolvedValue([]) });
    const b = stub({ name: "b", getOdds: vi.fn().mockResolvedValue([snap("ev-b")]) });
    const fb = createFallbackOddsProvider([a, b]);
    const res = await fb.getOdds("m" as MatchId, ["ML_1X2"]);
    expect(a.getOdds).toHaveBeenCalled();
    expect(b.getOdds).toHaveBeenCalled();
    expect(res[0].matchId).toBe("ev-b");
  });

  it("falls back when first throws retryable error", async () => {
    const a = stub({
      name: "a",
      getOdds: vi.fn().mockRejectedValue(new Error("odds-api.io rate limit reached (429)")),
    });
    const b = stub({ name: "b", getOdds: vi.fn().mockResolvedValue([snap("ev-b")]) });
    const fb = createFallbackOddsProvider([a, b]);
    const res = await fb.getOdds("m" as MatchId, ["ML_1X2"]);
    expect(res[0].matchId).toBe("ev-b");
  });

  it("returns last empty when all providers are empty", async () => {
    const a = stub({ name: "a", getOdds: vi.fn().mockResolvedValue([]) });
    const b = stub({ name: "b", getOdds: vi.fn().mockResolvedValue([]) });
    const fb = createFallbackOddsProvider([a, b]);
    const res = await fb.getOdds("m" as MatchId, ["ML_1X2"]);
    expect(res).toEqual([]);
  });

  it("respects order", async () => {
    const calls: string[] = [];
    const mk = (n: string): OddsProvider =>
      stub({
        name: n,
        getOdds: vi.fn().mockImplementation(async () => {
          calls.push(n);
          return n === "third" ? [snap("ok")] : [];
        }),
      });
    const fb = createFallbackOddsProvider([mk("first"), mk("second"), mk("third")]);
    await fb.getOdds("m" as MatchId, ["ML_1X2"]);
    expect(calls).toEqual(["first", "second", "third"]);
  });

  it("quota() returns first provider's quota", () => {
    const a = stub({
      name: "a",
      quota: () => ({
        remaining: 42,
        used: 8,
        resetAt: null,
        lastSyncedAt: null,
      }),
    });
    const b = stub({ name: "b" });
    const fb = createFallbackOddsProvider([a, b]);
    expect(fb.quota().remaining).toBe(42);
  });

  it("throws when zero providers", () => {
    expect(() => createFallbackOddsProvider([])).toThrow();
  });
});
