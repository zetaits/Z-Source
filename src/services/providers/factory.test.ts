import { describe, expect, it } from "vitest";
import type { AppSettings } from "@/services/settings/settingsStore";
import { resolveProviders } from "./factory";

const base: AppSettings = {
  oddsApiIoKey: null,
  footballDataApiKey: null,
  enabledLeagueIds: ["epl"],
  catalogProvider: "none",
  oddsRegion: "eu",
  splitProviderId: "action-network",
  historyProviderId: "none",
  userBooks: [],
  perSport: {},
};

describe("resolveProviders", () => {
  it("returns one component per configured provider id", () => {
    const r = resolveProviders(base);
    expect(r.oddsComponents.map((c) => c.id)).toEqual(["odds-api-io"]);
    expect(r.oddsComponents.every((c) => c.configured === false)).toBe(true);
  });

  it("marks configured=true when the matching key is set", () => {
    const r = resolveProviders({ ...base, oddsApiIoKey: "io-key" });
    const io = r.oddsComponents.find((c) => c.id === "odds-api-io")!;
    expect(io.configured).toBe(true);
  });

  it("odds provider is the single configured when only one has a key", () => {
    const r = resolveProviders({ ...base, oddsApiIoKey: "io-key" });
    expect(r.odds.name).toBe("odds-api-io");
  });

  it("exposes one quota tracker matching the ordered ids", () => {
    const r = resolveProviders(base);
    expect(r.quotaTrackers).toHaveLength(1);
    expect(r.quotaTrackers.map((t) => t.providerId)).toEqual(["odds-api-io"]);
  });
});
