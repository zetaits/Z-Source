/**
 * Bivariate Dixon-Coles score matrix and Asian-handicap fair probabilities.
 *
 * The matrix is a Poisson outer product with low-score correlation tweak (rho)
 * affecting (0,0), (0,1), (1,0), (1,1) cells, then renormalised. AH fair probs
 * use the same push-removal/quarter-line conventions as the over-under helper.
 */
import { classifyLine, poissonPmf } from "./poisson";

const MATRIX_DIM = 15;

export const buildDixonColesMatrix = (
  lamHome: number,
  lamAway: number,
  rho: number,
): number[][] => {
  const mat: number[][] = [];
  let total = 0;
  for (let h = 0; h < MATRIX_DIM; h++) {
    const row: number[] = [];
    for (let a = 0; a < MATRIX_DIM; a++) {
      let p = poissonPmf(lamHome, h) * poissonPmf(lamAway, a);
      if (h === 0 && a === 0) p *= 1 - lamHome * lamAway * rho;
      else if (h === 0 && a === 1) p *= 1 + lamHome * rho;
      else if (h === 1 && a === 0) p *= 1 + lamAway * rho;
      else if (h === 1 && a === 1) p *= 1 - rho;
      p = Math.max(0, p);
      row.push(p);
      total += p;
    }
    mat.push(row);
  }
  if (total <= 0) return mat;
  for (let h = 0; h < MATRIX_DIM; h++) {
    for (let a = 0; a < MATRIX_DIM; a++) {
      mat[h][a] /= total;
    }
  }
  return mat;
};

export interface RawAhProbs {
  home: number;
  away: number;
  push: number;
}

export const ahProbabilitiesRaw = (mat: number[][], line: number): RawAhProbs => {
  let home = 0;
  let away = 0;
  let push = 0;
  for (let h = 0; h < mat.length; h++) {
    for (let a = 0; a < mat[h].length; a++) {
      const d = h - a + line;
      if (d > 1e-9) home += mat[h][a];
      else if (d < -1e-9) away += mat[h][a];
      else push += mat[h][a];
    }
  }
  return { home, away, push };
};

export interface AhSidedProbs {
  home: number;
  away: number;
}

/**
 * P(BTTS=Yes) from a Dixon-Coles matrix: sum of cells where both teams score at
 * least once. Matrix is already normalised by `buildDixonColesMatrix`.
 */
export const bttsFairProbFromMatrix = (mat: number[][]): number => {
  let p = 0;
  for (let h = 1; h < mat.length; h++) {
    for (let a = 1; a < mat[h].length; a++) {
      p += mat[h][a];
    }
  }
  return p;
};

export interface OuSidedProbs {
  over: number;
  under: number;
}

/**
 * Over/Under fair probs from a Dixon-Coles matrix. Same push-removal /
 * quarter-line averaging convention as `ouFairProbs` from `./poisson`.
 */
export const ouFairProbsFromMatrix = (
  mat: number[][],
  line: number,
): OuSidedProbs => {
  const kind = classifyLine(line);
  if (kind === "quarter") {
    const before = ouFairProbsFromMatrix(mat, line - 0.25);
    const after = ouFairProbsFromMatrix(mat, line + 0.25);
    return {
      over: (before.over + after.over) / 2,
      under: (before.under + after.under) / 2,
    };
  }
  let over = 0;
  let under = 0;
  let push = 0;
  for (let h = 0; h < mat.length; h++) {
    for (let a = 0; a < mat[h].length; a++) {
      const total = h + a;
      if (total > line + 1e-9) over += mat[h][a];
      else if (total < line - 1e-9) under += mat[h][a];
      else push += mat[h][a];
    }
  }
  if (kind === "whole") {
    const denom = 1 - push;
    if (denom <= 0) return { over: 0.5, under: 0.5 };
    return { over: over / denom, under: under / denom };
  }
  return { over, under };
};

export const ahFairProbs = (mat: number[][], line: number): AhSidedProbs => {
  const kind = classifyLine(line);
  if (kind === "half") {
    const r = ahProbabilitiesRaw(mat, line);
    return { home: r.home, away: r.away };
  }
  if (kind === "whole") {
    const r = ahProbabilitiesRaw(mat, line);
    const denom = 1 - r.push;
    if (denom <= 0) return { home: 0.5, away: 0.5 };
    return { home: r.home / denom, away: r.away / denom };
  }
  const before = ahFairProbs(mat, line - 0.25);
  const after = ahFairProbs(mat, line + 0.25);
  return {
    home: (before.home + after.home) / 2,
    away: (before.away + after.away) / 2,
  };
};
