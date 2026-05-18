/**
 * Univariate Poisson primitives plus line-kind classification (whole / half / quarter)
 * and over-under fair probability with push handling.
 *
 * `ouFairProbs` follows the conditional-probability convention used for de-vigged
 * pricing: at a whole line, the push outcome is removed from the denominator;
 * at a quarter line, the result is the average of the two adjacent half/whole lines.
 */

const logFactorial = (n: number): number => {
  let r = 0;
  for (let i = 2; i <= n; i++) r += Math.log(i);
  return r;
};

export const poissonPmf = (lambda: number, k: number): number => {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  if (k < 0 || !Number.isInteger(k)) return 0;
  return Math.exp(-lambda + k * Math.log(lambda) - logFactorial(k));
};

export const poissonCdf = (lambda: number, k: number): number => {
  if (k < 0) return 0;
  const ki = Math.floor(k);
  let sum = 0;
  for (let i = 0; i <= ki; i++) sum += poissonPmf(lambda, i);
  return sum;
};

export type LineKind = "whole" | "half" | "quarter";

export const classifyLine = (line: number): LineKind => {
  const q = Math.abs(Math.round(line * 4));
  if (q % 4 === 0) return "whole";
  if (q % 2 === 0) return "half";
  return "quarter";
};

export interface SidedProbs {
  over: number;
  under: number;
}

export const ouFairProbs = (lambda: number, line: number): SidedProbs => {
  const kind = classifyLine(line);
  if (kind === "half") {
    const under = poissonCdf(lambda, Math.floor(line));
    return { under, over: 1 - under };
  }
  if (kind === "whole") {
    const lineInt = Math.round(line);
    const push = poissonPmf(lambda, lineInt);
    const denom = 1 - push;
    if (denom <= 0) return { under: 0.5, over: 0.5 };
    const under = poissonCdf(lambda, lineInt - 1) / denom;
    return { under, over: 1 - under };
  }
  const before = ouFairProbs(lambda, line - 0.25);
  const after = ouFairProbs(lambda, line + 0.25);
  return {
    under: (before.under + after.under) / 2,
    over: (before.over + after.over) / 2,
  };
};
