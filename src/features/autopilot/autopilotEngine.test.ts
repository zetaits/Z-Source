import { describe, it, expect } from "vitest";
import { gradeKs, closeWindowReached, CLOSE_LEAD_MINUTES } from "./autopilotEngine";

describe("gradeKs", () => {
  it("grades over half-lines (no push possible)", () => {
    expect(gradeKs("over", 5.5, 6)).toBe("WON");
    expect(gradeKs("over", 5.5, 5)).toBe("LOST");
  });

  it("grades under half-lines", () => {
    expect(gradeKs("under", 5.5, 5)).toBe("WON");
    expect(gradeKs("under", 5.5, 6)).toBe("LOST");
  });

  it("pushes on an exact integer-line match", () => {
    expect(gradeKs("over", 6, 6)).toBe("PUSH");
    expect(gradeKs("under", 6, 6)).toBe("PUSH");
  });

  it("grades integer lines either side of the number", () => {
    expect(gradeKs("over", 6, 7)).toBe("WON");
    expect(gradeKs("over", 6, 5)).toBe("LOST");
    expect(gradeKs("under", 6, 5)).toBe("WON");
    expect(gradeKs("under", 6, 7)).toBe("LOST");
  });

  it("does not mis-grade an unknown side", () => {
    expect(gradeKs("yes", 5.5, 9)).toBe("PUSH");
  });
});

describe("closeWindowReached", () => {
  const start = "2026-06-23T23:05:00Z";
  const startMs = Date.parse(start);

  it("is false well before the lead window", () => {
    expect(closeWindowReached(start, startMs - 60 * 60_000)).toBe(false);
  });

  it("opens exactly at start - lead minutes", () => {
    expect(closeWindowReached(start, startMs - CLOSE_LEAD_MINUTES * 60_000)).toBe(true);
  });

  it("stays true past first pitch", () => {
    expect(closeWindowReached(start, startMs + 30 * 60_000)).toBe(true);
  });

  it("is false when start time is unknown or unparseable", () => {
    expect(closeWindowReached(undefined, startMs)).toBe(false);
    expect(closeWindowReached("not-a-date", startMs)).toBe(false);
  });
});
