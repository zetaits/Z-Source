import type { Rule, RuleOutput } from "../types";
import { clamp } from "../ev";
import {
  buildDixonColesMatrix,
  bttsFairProbFromMatrix,
  ouFairProbsFromMatrix,
} from "../synthetic/dixonColes";

const STRENGTH_SCALE = 3;
const MAX_STRENGTH = 0.5;
const MIN_DELTA = 0.04;
const DC_RHO = 0.13;

export const bttsXgPoisson: Rule = {
  id: "btts-xg-poisson",
  description:
    "Dixon-Coles model on team xG (ρ=0.13) forecasts BTTS and OU goals; emits signal vs market vig-free prob.",
  markets: ["BTTS", "OU_GOALS"],
  leg: "matchup",
  defaultWeight: 0.9,
  run: ({ ctx, selection, baseProb, config }): RuleOutput | null => {
    const home = ctx.homeForm;
    const away = ctx.awayForm;
    if (!home || !away) return null;
    if (home.xGForLast === undefined || away.xGForLast === undefined) return null;
    if (home.lastN === 0 || away.lastN === 0) return null;

    const lambdaH = home.xGForLast / home.lastN;
    const lambdaA = away.xGForLast / away.lastN;
    if (lambdaH <= 0 || lambdaA <= 0) return null;

    const matrix = buildDixonColesMatrix(lambdaH, lambdaA, DC_RHO);

    let modelP: number;
    if (selection.marketKey === "BTTS") {
      const pBtts = bttsFairProbFromMatrix(matrix);
      modelP = selection.side === "yes" ? pBtts : 1 - pBtts;
    } else {
      if (selection.line === undefined) return null;
      const fair = ouFairProbsFromMatrix(matrix, selection.line);
      modelP = selection.side === "over" ? fair.over : fair.under;
    }

    const delta = modelP - baseProb;
    if (Math.abs(delta) < MIN_DELTA) return null;

    const strength = clamp(delta * STRENGTH_SCALE, -MAX_STRENGTH, MAX_STRENGTH);

    return {
      ruleId: "btts-xg-poisson",
      leg: "matchup",
      verdict: strength > 0 ? "SUPPORT" : "AGAINST",
      strength,
      weight: config.weight,
      message: `DC(λH=${lambdaH.toFixed(2)}, λA=${lambdaA.toFixed(2)}) → ${(modelP * 100).toFixed(1)}% model vs ${(baseProb * 100).toFixed(1)}% market`,
      data: {
        lambdaH,
        lambdaA,
        rho: DC_RHO,
        modelP,
        baseProb,
        delta,
      },
    };
  },
};
