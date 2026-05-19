import type { Rule, RuleOutput } from "../types";
import { clamp } from "../ev";
import { classifyLine } from "../synthetic/poisson";
import { buildDixonColesMatrix } from "../synthetic/dixonColes";

const STRENGTH_SCALE = 3;
const MAX_STRENGTH = 0.5;
const MIN_DELTA = 0.04;
const DC_RHO = 0.13;

interface SidedProbs {
  over: number;
  under: number;
}

const teamFairProbs = (
  mat: number[][],
  teamIsHome: boolean,
  line: number,
): SidedProbs => {
  const kind = classifyLine(line);
  if (kind === "quarter") {
    const before = teamFairProbs(mat, teamIsHome, line - 0.25);
    const after = teamFairProbs(mat, teamIsHome, line + 0.25);
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
      const k = teamIsHome ? h : a;
      if (k > line + 1e-9) over += mat[h][a];
      else if (k < line - 1e-9) under += mat[h][a];
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

export const teamTotalsXgDc: Rule = {
  id: "ttg-xg-dc",
  description:
    "Dixon-Coles marginal on team xG forecasts Team Total Goals over/under per side.",
  markets: ["TTG_HOME", "TTG_AWAY"],
  leg: "matchup",
  defaultWeight: 0.9,
  run: ({ ctx, selection, baseProb, config }): RuleOutput | null => {
    const home = ctx.homeForm;
    const away = ctx.awayForm;
    if (!home || !away) return null;
    if (home.xGForLast === undefined || away.xGForLast === undefined) return null;
    if (home.lastN === 0 || away.lastN === 0) return null;
    if (selection.line === undefined) return null;

    const lambdaH = home.xGForLast / home.lastN;
    const lambdaA = away.xGForLast / away.lastN;
    if (lambdaH <= 0 || lambdaA <= 0) return null;

    const mat = buildDixonColesMatrix(lambdaH, lambdaA, DC_RHO);
    const teamIsHome = selection.marketKey === "TTG_HOME";
    const fair = teamFairProbs(mat, teamIsHome, selection.line);
    const modelP = selection.side === "over" ? fair.over : fair.under;

    const delta = modelP - baseProb;
    if (Math.abs(delta) < MIN_DELTA) return null;

    const strength = clamp(delta * STRENGTH_SCALE, -MAX_STRENGTH, MAX_STRENGTH);
    const teamLabel = teamIsHome ? "home" : "away";

    return {
      ruleId: "ttg-xg-dc",
      leg: "matchup",
      family: "poisson-xg",
      verdict: strength > 0 ? "SUPPORT" : "AGAINST",
      strength,
      weight: config.weight,
      message: `DC(${teamLabel} λ=${(teamIsHome ? lambdaH : lambdaA).toFixed(2)}) → ${(modelP * 100).toFixed(1)}% model vs ${(baseProb * 100).toFixed(1)}% market`,
      data: {
        lambdaH,
        lambdaA,
        rho: DC_RHO,
        modelP,
        baseProb,
        delta,
        teamIsHome,
        line: selection.line,
      },
    };
  },
};
