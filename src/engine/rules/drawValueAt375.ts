import type { Rule, RuleOutput } from "../types";

const THRESHOLD = 3.75;

export const drawValueAt375: Rule = {
  id: "draw-value-375",
  description: "Draws at decimal ≥ 3.75 are systematically undervalued across leagues.",
  markets: ["ML_1X2"],
  leg: "lines",
  defaultWeight: 1,
  run: ({ selection, price, config }): RuleOutput | null => {
    if (selection.side !== "draw") return null;
    if (price.decimal < THRESHOLD) return null;
    const excess = price.decimal - THRESHOLD;
    const strength = Math.min(0.2 + excess * 0.15, 0.6);
    return {
      ruleId: "draw-value-375",
      leg: "lines",
      verdict: "SUPPORT",
      strength,
      weight: config.weight,
      message: `Draw priced ${price.decimal.toFixed(2)} ≥ ${THRESHOLD.toFixed(2)} · value threshold`,
      data: { threshold: THRESHOLD, priceDecimal: price.decimal },
    };
  },
};
