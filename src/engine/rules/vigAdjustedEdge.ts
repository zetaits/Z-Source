import { clamp, edgePct } from "../ev";
import type { Rule, RuleOutput } from "../types";

export const vigAdjustedEdge: Rule = {
  id: "vig-adjusted-edge",
  description: "Baseline edge after removing vig across books.",
  markets: "*",
  leg: "math",
  defaultWeight: 1,
  run: ({ baseProb, price }): RuleOutput | null => {
    const edge = edgePct(baseProb, price.decimal);
    const strength = clamp(edge * 5, -1, 1);
    const verdict =
      edge > 0.005 ? "SUPPORT" : edge < -0.005 ? "AGAINST" : "NEUTRAL";
    return {
      ruleId: "vig-adjusted-edge",
      leg: "math",
      verdict,
      strength,
      weight: 1,
      message: `Vig-adjusted edge ${(edge * 100).toFixed(2)}% @ ${price.decimal.toFixed(2)}`,
      data: { edgePct: edge, fairProb: baseProb, price: price.decimal },
    };
  },
};
