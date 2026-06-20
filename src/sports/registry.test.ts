import { describe, expect, it } from "vitest";
import { SPORTS } from "@/config/sports";
import { getSportModule, hasSportModule } from "./registry";

describe("sport registry", () => {
  it("every sport in the UI registry resolves to a module", () => {
    for (const sport of SPORTS) {
      expect(hasSportModule(sport.id)).toBe(true);
      expect(getSportModule(sport.id).id).toBe(sport.id);
    }
  });

  it("falls back to a real module for unknown ids", () => {
    expect(getSportModule("___nope___").id).toBeTruthy();
  });

  it("football is fully wired; others may be stubs", () => {
    const football = getSportModule("football");
    expect(football.engine.adapters.length).toBeGreaterThan(0);
    expect(football.capabilities.odds).toBe(true);
  });

  it("baseball has a fixtures feed but no engine yet", () => {
    const baseball = getSportModule("baseball");
    expect(baseball.engine.adapters.length).toBe(0);
    expect(baseball.fixtureSources().length).toBeGreaterThan(0);
  });
});
