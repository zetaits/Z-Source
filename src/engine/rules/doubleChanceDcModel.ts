import type { Rule, RuleOutput } from "../types";
import { clamp } from "../ev";
import { buildDixonColesMatrix } from "../synthetic/dixonColes";

const STRENGTH_SCALE = 3;
const MAX_STRENGTH = 0.5;
const MIN_DELTA = 0.04;
const DC_RHO = 0.13;
const SYNTHETIC_BOOK = "synthetic-from-ml";

type DcSide = "1X" | "12" | "X2";

const dcModelProb = (mat: number[][], side: DcSide): number => {
  let pHomeWin = 0;
  let pDraw = 0;
  let pAwayWin = 0;
  for (let h = 0; h < mat.length; h++) {
    for (let a = 0; a < mat[h].length; a++) {
      if (h > a) pHomeWin += mat[h][a];
      else if (h < a) pAwayWin += mat[h][a];
      else pDraw += mat[h][a];
    }
  }
  switch (side) {
    case "1X":
      return pHomeWin + pDraw;
    case "12":
      return pHomeWin + pAwayWin;
    case "X2":
      return pDraw + pAwayWin;
  }
};

export const doubleChanceDcModel: Rule = {
  id: "dc-xg-model",
  description:
    "Dixon-Coles model on team xG forecasts Double Chance outcomes; skips when DC price is synthesised from ML (circular guard).",
  markets: ["DC"],
  leg: "matchup",
  defaultWeight: 0.9,
  run: ({ ctx, selection, baseProb, price, config }): RuleOutput | null => {
    if (price.book === SYNTHETIC_BOOK) return null;

    const home = ctx.homeForm;
    const away = ctx.awayForm;
    if (!home || !away) return null;
    if (home.xGForLast === undefined || away.xGForLast === undefined) return null;
    if (home.lastN === 0 || away.lastN === 0) return null;

    const lambdaH = home.xGForLast / home.lastN;
    const lambdaA = away.xGForLast / away.lastN;
    if (lambdaH <= 0 || lambdaA <= 0) return null;

    const mat = buildDixonColesMatrix(lambdaH, lambdaA, DC_RHO);
    const modelP = dcModelProb(mat, selection.side as DcSide);
    const delta = modelP - baseProb;
    if (Math.abs(delta) < MIN_DELTA) return null;

    const strength = clamp(delta * STRENGTH_SCALE, -MAX_STRENGTH, MAX_STRENGTH);

    return {
      ruleId: "dc-xg-model",
      leg: "matchup",
      verdict: strength > 0 ? "SUPPORT" : "AGAINST",
      strength,
      weight: config.weight,
      message: `DC(λH=${lambdaH.toFixed(2)}, λA=${lambdaA.toFixed(2)}) → ${(modelP * 100).toFixed(1)}% model vs ${(baseProb * 100).toFixed(1)}% market`,
      data: { lambdaH, lambdaA, rho: DC_RHO, modelP, baseProb, delta },
    };
  },
};
