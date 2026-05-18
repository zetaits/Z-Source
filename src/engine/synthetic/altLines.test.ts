import { describe, expect, it } from "vitest";
import {
  buildLineLadder,
  fitMarketModel,
  synthesizeAsianHandicap,
  synthesizeOverUnder,
} from "./altLines";
import { ahFairProbs, buildDixonColesMatrix } from "./dixonColes";
import {
  fitLambdaOU,
  fitLambdaSplitAH,
  fitLambdaSplitJoint,
  fitPowerK,
  fitPowerKN,
} from "./optimizer";
import { ahProbabilitiesRaw } from "./dixonColes";
import { classifyLine, ouFairProbs, poissonCdf, poissonPmf } from "./poisson";

describe("poisson primitives", () => {
  it("PMF at λ=2.5, k=2 ≈ 0.2565", () => {
    expect(poissonPmf(2.5, 2)).toBeCloseTo(0.2565, 3);
  });
  it("CDF converges to 1 for large k", () => {
    expect(poissonCdf(2.5, 30)).toBeCloseTo(1, 6);
  });
  it("PMF at non-integer k is 0", () => {
    expect(poissonPmf(2.5, 1.5)).toBe(0);
  });
});

describe("classifyLine", () => {
  it.each<[number, "whole" | "half" | "quarter"]>([
    [2.5, "half"],
    [2.0, "whole"],
    [2.25, "quarter"],
    [2.75, "quarter"],
    [-1.5, "half"],
    [-1.25, "quarter"],
    [-1.0, "whole"],
    [0, "whole"],
  ])("classifyLine(%s) = %s", (line, kind) => {
    expect(classifyLine(line)).toBe(kind);
  });
});

describe("ouFairProbs", () => {
  it("at λ=2.5, line=2.5 P(under) = P(goals ≤ 2)", () => {
    const { under } = ouFairProbs(2.5, 2.5);
    expect(under).toBeCloseTo(poissonCdf(2.5, 2), 6);
  });
  it("at half line: over + under = 1 (no push)", () => {
    const { over, under } = ouFairProbs(2.5, 2.5);
    expect(over + under).toBeCloseTo(1, 6);
  });
  it("at whole line: over + under = 1 after push removal", () => {
    const { over, under } = ouFairProbs(2.5, 3.0);
    expect(over + under).toBeCloseTo(1, 6);
  });
  it("quarter line is mean of adjacent half/whole", () => {
    const q = ouFairProbs(2.5, 2.25);
    const w = ouFairProbs(2.5, 2.0);
    const h = ouFairProbs(2.5, 2.5);
    expect(q.under).toBeCloseTo((w.under + h.under) / 2, 6);
  });
});

describe("dixon-coles", () => {
  it("matrix rows sum to 1", () => {
    const mat = buildDixonColesMatrix(1.5, 1.0, 0.13);
    let s = 0;
    for (const row of mat) for (const v of row) s += v;
    expect(s).toBeCloseTo(1, 6);
  });
  it("AH at half line: home + away = 1", () => {
    const mat = buildDixonColesMatrix(1.5, 1.0, 0.13);
    const { home, away } = ahFairProbs(mat, -0.5);
    expect(home + away).toBeCloseTo(1, 6);
  });
  it("AH at whole line: home + away = 1 after push removal", () => {
    const mat = buildDixonColesMatrix(1.5, 1.0, 0.13);
    const { home, away } = ahFairProbs(mat, 0);
    expect(home + away).toBeCloseTo(1, 6);
  });
  it("higher home λ shifts P(home cover) up at line=-0.5", () => {
    const lo = ahFairProbs(buildDixonColesMatrix(1.0, 1.0, 0.13), -0.5);
    const hi = ahFairProbs(buildDixonColesMatrix(2.0, 1.0, 0.13), -0.5);
    expect(hi.home).toBeGreaterThan(lo.home);
  });
});

describe("fitPowerK", () => {
  it("recovers k≈1 from fair (no-vig) prices", () => {
    const k = fitPowerK([{ a: 2, b: 2 }]);
    expect(k).toBeCloseTo(1, 2);
  });
  it("recovers k>1 from vigged prices", () => {
    const k = fitPowerK([{ a: 1.91, b: 1.91 }]);
    expect(k).toBeGreaterThan(1);
    expect(k).toBeLessThan(1.3);
  });
  it("multi-pair fit converges with shared overround", () => {
    const k = fitPowerK([
      { a: 1.91, b: 1.91 },
      { a: 2.5, b: 1.55 },
      { a: 2.7, b: 1.46 },
    ]);
    expect(k).toBeGreaterThan(1);
    expect(k).toBeLessThan(1.3);
  });
});

describe("fitLambdaOU", () => {
  it("recovers λ from a single fair line", () => {
    const trueLambda = 2.5;
    const fair = ouFairProbs(trueLambda, 2.5);
    const cO = 1 / fair.over;
    const cU = 1 / fair.under;
    const k = fitPowerK([{ a: cO, b: cU }]);
    const lambda = fitLambdaOU(k, [{ line: 2.5, over: cO, under: cU }]);
    expect(k).toBeCloseTo(1, 2);
    expect(lambda).toBeCloseTo(trueLambda, 1);
  });
  it("multi-line fit reduces residual at extrapolation", () => {
    const trueLambda = 2.7;
    const lines = [2.5, 3.0, 3.25];
    const bases = lines.map((line) => {
      const { over, under } = ouFairProbs(trueLambda, line);
      return { line, over: 1 / over, under: 1 / under };
    });
    const k = fitPowerK(bases.map((b) => ({ a: b.over, b: b.under })));
    const lambda = fitLambdaOU(k, bases);
    expect(lambda).toBeCloseTo(trueLambda, 1);
  });
});

describe("fitLambdaSplitAH", () => {
  it("recovers λ_h≈λ_a when bases are symmetric", () => {
    const lamTotal = 2.5;
    const rho = 0.13;
    const mat = buildDixonColesMatrix(1.25, 1.25, rho);
    const ahBases = [-0.5, -0.25].map((line) => {
      const { home, away } = ahFairProbs(mat, line);
      return { line, home: 1 / home, away: 1 / away };
    });
    const k = fitPowerK(ahBases.map((b) => ({ a: b.home, b: b.away })));
    const lamH = fitLambdaSplitAH(lamTotal, k, rho, ahBases);
    expect(lamH).toBeCloseTo(1.25, 1);
  });
});

describe("fitPowerKN (n-way)", () => {
  it("recovers k≈1 from fair 1X2 prices", () => {
    const lam = 2.5, rho = 0.13;
    const mat = buildDixonColesMatrix(1.4, 1.1, rho);
    const r = ahProbabilitiesRaw(mat, 0);
    const k = fitPowerKN([[1 / r.home, 1 / r.push, 1 / r.away]]);
    expect(k).toBeCloseTo(1, 2);
    void lam;
  });
  it("recovers k>1 from vigged 1X2 prices", () => {
    const k = fitPowerKN([[2.3, 3.4, 3.1]]);
    expect(k).toBeGreaterThan(1);
    expect(k).toBeLessThan(1.3);
  });
});

describe("fitLambdaSplitJoint (AH + 1X2)", () => {
  it("matches AH-only fit when 1X2 is omitted", () => {
    const lamTotal = 2.5;
    const rho = 0.13;
    const mat = buildDixonColesMatrix(1.6, 0.9, rho);
    const ahBases = [-0.5, -0.25, -0.75].map((line) => {
      const { home, away } = ahFairProbs(mat, line);
      return { line, home: 1 / home, away: 1 / away };
    });
    const k = fitPowerK(ahBases.map((b) => ({ a: b.home, b: b.away })));
    const lamHJoint = fitLambdaSplitJoint(lamTotal, k, rho, ahBases);
    const lamHOnly = fitLambdaSplitAH(lamTotal, k, rho, ahBases);
    expect(lamHJoint).toBeCloseTo(lamHOnly, 3);
  });

  it("tightens split recovery when AH bases cluster near pivot and 1X2 added", () => {
    const lamTotal = 2.7;
    const rho = 0.13;
    const trueLamHome = 1.85;
    const trueLamAway = lamTotal - trueLamHome;
    const mat = buildDixonColesMatrix(trueLamHome, trueLamAway, rho);
    // AH bases clustered near pivot (-0.75 only) → weak split signal
    const ahBases = [-0.75].map((line) => {
      const { home, away } = ahFairProbs(mat, line);
      return { line, home: 1 / home, away: 1 / away };
    });
    // 1X2 base from same true matrix
    const r = ahProbabilitiesRaw(mat, 0);
    const ml = { home: 1 / r.home, draw: 1 / r.push, away: 1 / r.away };
    const k = fitPowerK(ahBases.map((b) => ({ a: b.home, b: b.away })));
    const lamHAhOnly = fitLambdaSplitAH(lamTotal, k, rho, ahBases);
    const lamHJoint = fitLambdaSplitJoint(lamTotal, k, rho, ahBases, ml);
    const errAhOnly = Math.abs(lamHAhOnly - trueLamHome);
    const errJoint = Math.abs(lamHJoint - trueLamHome);
    expect(errJoint).toBeLessThanOrEqual(errAhOnly);
    expect(lamHJoint).toBeCloseTo(trueLamHome, 1);
  });
});

describe("synthesizeOverUnder", () => {
  it("reproduces base price within tight tolerance", () => {
    const trueLambda = 2.7;
    const bases = [2.5, 3.0, 3.25].map((line) => {
      const { over, under } = ouFairProbs(trueLambda, line);
      return { line, over: 1 / over, under: 1 / under };
    });
    const synth = synthesizeOverUnder(bases, [2.5]);
    const overSyn = synth.find((s) => s.side === "over");
    expect(overSyn).toBeDefined();
    expect(overSyn!.decimal).toBeCloseTo(bases[0].over, 1);
  });
  it("emits 2 offers per target line", () => {
    const bases = [
      { line: 2.5, over: 1.91, under: 1.91 },
      { line: 3.0, over: 2.5, under: 1.55 },
      { line: 3.25, over: 2.7, under: 1.46 },
    ];
    const out = synthesizeOverUnder(bases, [4.5, 5.0]);
    expect(out).toHaveLength(4);
  });
  it("confidence band grows with distance from nearest base", () => {
    const bases = [
      { line: 2.5, over: 1.91, under: 1.91 },
      { line: 3.0, over: 2.5, under: 1.55 },
    ];
    const close = synthesizeOverUnder(bases, [2.75]);
    const far = synthesizeOverUnder(bases, [5.5]);
    expect(far[0].confidencePct).toBeGreaterThan(close[0].confidencePct);
  });
});

describe("synthesizeAsianHandicap", () => {
  it("emits 2 offers per target line", () => {
    const ou = [{ line: 2.5, over: 1.91, under: 1.91 }];
    const ah = [
      { line: -1.5, home: 2.4, away: 1.6 },
      { line: -1.25, home: 2.1, away: 1.78 },
    ];
    const out = synthesizeAsianHandicap(ou, ah, [-2.0]);
    expect(out).toHaveLength(2);
    expect(out.find((o) => o.side === "home")).toBeDefined();
    expect(out.find((o) => o.side === "away")).toBeDefined();
  });
  it("home price gets longer as target line gets harder", () => {
    const ou = [{ line: 2.5, over: 1.91, under: 1.91 }];
    const ah = [
      { line: -1.5, home: 2.4, away: 1.6 },
      { line: -1.25, home: 2.1, away: 1.78 },
    ];
    const easier = synthesizeAsianHandicap(ou, ah, [-1.0]);
    const harder = synthesizeAsianHandicap(ou, ah, [-2.5]);
    const easierHome = easier.find((o) => o.side === "home")!;
    const harderHome = harder.find((o) => o.side === "home")!;
    expect(harderHome.decimal).toBeGreaterThan(easierHome.decimal);
  });
});

describe("fitMarketModel", () => {
  it("returns null when O/U bases missing", () => {
    expect(fitMarketModel([])).toBeNull();
  });
  it("fits O/U only when AH absent", () => {
    const fit = fitMarketModel([{ line: 2.5, over: 1.91, under: 1.91 }]);
    expect(fit?.ou.lambda).toBeGreaterThan(2);
    expect(fit?.ou.lambda).toBeLessThan(3);
    expect(fit?.ah).toBeUndefined();
  });
  it("includes AH split when AH bases present", () => {
    const fit = fitMarketModel(
      [{ line: 2.5, over: 1.91, under: 1.91 }],
      [
        { line: -1.5, home: 2.4, away: 1.6 },
        { line: -1.25, home: 2.1, away: 1.78 },
      ],
    );
    expect(fit?.ah).toBeDefined();
    expect(fit!.ah!.lamHome).toBeGreaterThan(0);
    expect(fit!.ah!.lamAway).toBeGreaterThan(0);
    expect(fit!.ah!.lamHome + fit!.ah!.lamAway).toBeCloseTo(fit!.ou.lambda, 1);
  });
});

describe("buildLineLadder", () => {
  it("produces quarter-spaced ladder excluding centre", () => {
    const ladder = buildLineLadder(2.5, 1.0);
    expect(ladder).not.toContain(2.5);
    expect(ladder).toContain(2.25);
    expect(ladder).toContain(2.75);
    expect(ladder).toContain(2.0);
    expect(ladder).toContain(3.0);
    expect(ladder.length).toBe(8);
  });
});
