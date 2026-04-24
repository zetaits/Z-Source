import { describe, expect, it } from "vitest";
import type { AppSettings } from "@/services/settings/settingsStore";
import { resolveProviders } from "./factory";

const base: AppSettings = {
  oddsApiKey: null,
  oddsApiIoKey: null,
  enabledLeagueIds: ["epl"],
  catalogProvider: "sofascore",
  oddsRegion: "eu",
  oddsProviderOrder: ["odds-api-io", "the-odds-api"],
  splitProviderId: "action-network",
  historyProviderId: "sofascore",
};

describe("resolveProviders", () => {
  it("returns one component per configured provider id", () => {
    const r = resolveProviders(base);
    expect(r.oddsComponents.map((c) => c.id)).toEqual(["odds-api-io", "the-odds-api"]);
    expect(r.oddsComponents.every((c) => c.configured === false)).toBe(true);
  });

  it("marks configured=true when the matching key is set", () => {
    const r = resolveProviders({ ...base, oddsApiIoKey: "io-key" });
    const io = r.oddsComponents.find((c) => c.id === "odds-api-io")!;
    const oa = r.oddsComponents.find((c) => c.id === "the-odds-api")!;
    expect(io.configured).toBe(true);
    expect(oa.configured).toBe(false);
  });

  it("respects oddsProviderOrder", () => {
    const r = resolveProviders({
      ...base,
      oddsProviderOrder: ["the-odds-api", "odds-api-io"],
    });
    expect(r.oddsComponents.map((c) => c.id)).toEqual(["the-odds-api", "odds-api-io"]);
    expect(r.quotaTrackers[0].providerId).toBe("the-odds-api");
  });

  it("odds provider is the single configured when only one has a key", () => {
    const r = resolveProviders({ ...base, oddsApiIoKey: "io-key" });
    expect(r.odds.name).toBe("odds-api-io");
  });

  it("odds provider is a fallback wrapper when both are configured", () => {
    const r = resolveProviders({
      ...base,
      oddsApiKey: "oa-key",
      oddsApiIoKey: "io-key",
    });
    expect(r.odds.name).toContain("fallback");
  });

  it("exposes 2 quota trackers matching the ordered ids", () => {
    const r = resolveProviders(base);
    expect(r.quotaTrackers).toHaveLength(2);
    expect(r.quotaTrackers.map((t) => t.providerId)).toEqual([
      "odds-api-io",
      "the-odds-api",
    ]);
  });
});
