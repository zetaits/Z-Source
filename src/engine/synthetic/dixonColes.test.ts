import { describe, expect, it } from "vitest";
import {
  bttsFairProbFromMatrix,
  buildDixonColesMatrix,
  ouFairProbsFromMatrix,
} from "./dixonColes";

const poissonBtts = (lh: number, la: number): number =>
  (1 - Math.exp(-lh)) * (1 - Math.exp(-la));

describe("bttsFairProbFromMatrix", () => {
  it("with ρ=0 equals independent-Poisson P(BTTS) within tolerance", () => {
    const lh = 1.4;
    const la = 1.3;
    const mat = buildDixonColesMatrix(lh, la, 0);
    const dcP = bttsFairProbFromMatrix(mat);
    const naive = poissonBtts(lh, la);
    expect(Math.abs(dcP - naive)).toBeLessThan(1e-4);
  });

  it("with ρ=0.13 produces P(BTTS) lower than independent-Poisson", () => {
    const lh = 1.4;
    const la = 1.3;
    const naive = poissonBtts(lh, la);
    const dcMat = buildDixonColesMatrix(lh, la, 0.13);
    const dcP = bttsFairProbFromMatrix(dcMat);
    expect(dcP).toBeLessThan(naive);
    expect(naive - dcP).toBeGreaterThan(0.01);
  });

  it("falls inside (0,1) for typical football lambdas", () => {
    for (const [lh, la] of [
      [1.0, 1.0],
      [2.2, 0.8],
      [0.6, 0.6],
      [3.0, 2.0],
    ] as Array<[number, number]>) {
      const mat = buildDixonColesMatrix(lh, la, 0.13);
      const p = bttsFairProbFromMatrix(mat);
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThan(1);
    }
  });
});

describe("ouFairProbsFromMatrix", () => {
  it("over+under sum to 1 on half lines", () => {
    const mat = buildDixonColesMatrix(1.4, 1.3, 0.13);
    const { over, under } = ouFairProbsFromMatrix(mat, 2.5);
    expect(over + under).toBeCloseTo(1, 5);
  });

  it("over+under sum to 1 on whole lines (push removed)", () => {
    const mat = buildDixonColesMatrix(1.4, 1.3, 0.13);
    const { over, under } = ouFairProbsFromMatrix(mat, 3);
    expect(over + under).toBeCloseTo(1, 5);
  });

  it("quarter line is the average of adjacent half/whole lines", () => {
    const mat = buildDixonColesMatrix(1.4, 1.3, 0.13);
    const at275 = ouFairProbsFromMatrix(mat, 2.75);
    const at25 = ouFairProbsFromMatrix(mat, 2.5);
    const at3 = ouFairProbsFromMatrix(mat, 3);
    expect(at275.over).toBeCloseTo((at25.over + at3.over) / 2, 5);
  });

  it("over rises with lambda total", () => {
    const matLow = buildDixonColesMatrix(0.8, 0.8, 0.13);
    const matHigh = buildDixonColesMatrix(2.2, 2.0, 0.13);
    const overLow = ouFairProbsFromMatrix(matLow, 2.5).over;
    const overHigh = ouFairProbsFromMatrix(matHigh, 2.5).over;
    expect(overHigh).toBeGreaterThan(overLow);
  });
});
