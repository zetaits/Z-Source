import type { Rule } from "../types";
import { cornersHighTempo } from "./cornersHighTempo";
import { drawValueAt375 } from "./drawValueAt375";
import { favFullMatchToFirstHalf } from "./favFullMatchToFirstHalf";
import { formDivergence } from "./formDivergence";
import { h2hDominance } from "./h2hDominance";
import { lineMovementVsPublic } from "./lineMovementVsPublic";
import { restCongestion } from "./restCongestion";
import { sharpSquareDetector } from "./sharpSquareDetector";
import { vigAdjustedEdge } from "./vigAdjustedEdge";

export const RULES: Rule[] = [
  vigAdjustedEdge,
  drawValueAt375,
  lineMovementVsPublic,
  sharpSquareDetector,
  favFullMatchToFirstHalf,
  cornersHighTempo,
  formDivergence,
  h2hDominance,
  restCongestion,
];

export const ruleById = (id: string): Rule | undefined =>
  RULES.find((r) => r.id === id);

export {
  cornersHighTempo,
  drawValueAt375,
  favFullMatchToFirstHalf,
  formDivergence,
  h2hDominance,
  lineMovementVsPublic,
  restCongestion,
  sharpSquareDetector,
  vigAdjustedEdge,
};
