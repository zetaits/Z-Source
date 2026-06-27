import { describe, expect, it } from "vitest";
import type { MarketKey } from "@/domain/market";
import { MARKET_SIDES, sidesFor } from "./marketSides";

// Regression: logging a baseball pitcher-K bet crashed the BetEntryDialog with
// "Cannot read properties of undefined (reading 'hasLine')" because PITCHER_KS
// had no MARKET_SIDES entry and sidesFor returned undefined.
describe("sidesFor", () => {
  it("returns an Over/Under line config for PITCHER_KS (baseball props)", () => {
    const cfg = sidesFor("PITCHER_KS");
    expect(cfg).toBeDefined();
    expect(cfg.hasLine).toBe(true);
    expect(cfg.sides.map((s) => s.value)).toEqual(["over", "under"]);
  });

  it("never returns undefined for any known market key", () => {
    for (const key of Object.keys(MARKET_SIDES) as MarketKey[]) {
      expect(sidesFor(key)).toBeDefined();
      expect(typeof sidesFor(key).hasLine).toBe("boolean");
    }
  });

  it("falls back to a safe Over/Under config for an unmapped key (no crash)", () => {
    const cfg = sidesFor("TOTALLY_NOT_A_MARKET" as MarketKey);
    expect(cfg).toBeDefined();
    expect(typeof cfg.hasLine).toBe("boolean");
  });
});
