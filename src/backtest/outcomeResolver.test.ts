import { describe, expect, it } from "vitest";
import type { Selection } from "@/domain/market";
import { resolveOutcome } from "./outcomeResolver";

const sel = (s: Partial<Selection> & Pick<Selection, "marketKey" | "side">): Selection =>
  s as Selection;

describe("resolveOutcome", () => {
  it("ML_1X2 home wins when home goals > away", () => {
    const r = resolveOutcome(sel({ marketKey: "ML_1X2", side: "home" }), 2.0, 1, 2, 1);
    expect(r.outcome).toBe("WIN");
    expect(r.payoutUnits).toBe(2);
  });

  it("ML_1X2 home loses on draw", () => {
    const r = resolveOutcome(sel({ marketKey: "ML_1X2", side: "home" }), 2.0, 1, 1, 1);
    expect(r.outcome).toBe("LOSS");
    expect(r.payoutUnits).toBe(0);
  });

  it("DNB returns stake on draw", () => {
    const r = resolveOutcome(sel({ marketKey: "DNB", side: "home" }), 2.0, 1, 1, 1);
    expect(r.outcome).toBe("VOID");
    expect(r.payoutUnits).toBe(1);
  });

  it("AH home -0.5 wins when home wins by 1+", () => {
    const r = resolveOutcome(
      sel({ marketKey: "AH", side: "home", line: -0.5 }),
      1.9,
      1,
      2,
      1,
    );
    expect(r.outcome).toBe("WIN");
  });

  it("AH home 0 PUSH on draw", () => {
    const r = resolveOutcome(
      sel({ marketKey: "AH", side: "home", line: 0 }),
      1.9,
      1,
      1,
      1,
    );
    expect(r.outcome).toBe("PUSH");
    expect(r.payoutUnits).toBe(1);
  });

  it("AH quarter -0.25 home wins half-stake on draw", () => {
    const r = resolveOutcome(
      sel({ marketKey: "AH", side: "home", line: -0.25 }),
      1.9,
      1,
      1,
      1,
    );
    expect(r.outcome).toBe("LOSS");
    expect(r.payoutUnits).toBeCloseTo(0.5);
  });

  it("OU 2.5 over wins when total > 2.5", () => {
    const r = resolveOutcome(
      sel({ marketKey: "OU_GOALS", side: "over", line: 2.5 }),
      1.9,
      1,
      2,
      1,
    );
    expect(r.outcome).toBe("WIN");
  });

  it("OU 3 PUSH when total == 3", () => {
    const r = resolveOutcome(
      sel({ marketKey: "OU_GOALS", side: "over", line: 3 }),
      1.9,
      1,
      2,
      1,
    );
    expect(r.outcome).toBe("PUSH");
  });

  it("BTTS yes wins when both score", () => {
    const r = resolveOutcome(sel({ marketKey: "BTTS", side: "yes" }), 1.9, 1, 1, 1);
    expect(r.outcome).toBe("WIN");
  });

  it("BTTS no wins on clean sheet", () => {
    const r = resolveOutcome(sel({ marketKey: "BTTS", side: "no" }), 1.9, 1, 2, 0);
    expect(r.outcome).toBe("WIN");
  });

  it("DC 1X wins on draw", () => {
    const r = resolveOutcome(sel({ marketKey: "DC", side: "1X" }), 1.5, 1, 1, 1);
    expect(r.outcome).toBe("WIN");
  });

  it("DC 12 loses on draw", () => {
    const r = resolveOutcome(sel({ marketKey: "DC", side: "12" }), 1.5, 1, 1, 1);
    expect(r.outcome).toBe("LOSS");
  });

  it("TTG_HOME over 1.5 wins when home scores 2+", () => {
    const r = resolveOutcome(
      sel({ marketKey: "TTG_HOME", side: "over", line: 1.5 }),
      1.9,
      1,
      2,
      0,
    );
    expect(r.outcome).toBe("WIN");
  });

  it("TTG_AWAY under 1.5 wins when away fails to score 2", () => {
    const r = resolveOutcome(
      sel({ marketKey: "TTG_AWAY", side: "under", line: 1.5 }),
      1.9,
      1,
      0,
      1,
    );
    expect(r.outcome).toBe("WIN");
  });
});
