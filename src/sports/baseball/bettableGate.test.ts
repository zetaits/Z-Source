import { describe, it, expect } from "vitest";
import { isBettableKs } from "./analyze";

const EV = 0.05;

describe("isBettableKs — Outs-line length gate", () => {
  it("bets when EV clears threshold AND length is anchored to a market Outs line", () => {
    expect(isBettableKs(0.12, true, EV)).toBe(true);
    expect(isBettableKs(0.05, true, EV)).toBe(true);
  });

  it("never bets without a market Outs-line anchor, however big the EV", () => {
    expect(isBettableKs(0.5, false, EV)).toBe(false);
    expect(isBettableKs(0.12, false, EV)).toBe(false);
  });

  it("never bets below the EV threshold even when anchored", () => {
    expect(isBettableKs(0.04, true, EV)).toBe(false);
    expect(isBettableKs(-0.2, true, EV)).toBe(false);
  });
});
