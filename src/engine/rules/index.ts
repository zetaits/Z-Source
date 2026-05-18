import type { Rule } from "../types";
import { bttsXgPoisson } from "./bttsXgPoisson";
import { cornersHighTempo } from "./cornersHighTempo";
import { doubleChanceDcModel } from "./doubleChanceDcModel";
import { drawValueAt375 } from "./drawValueAt375";
import { favFullMatchToFirstHalf } from "./favFullMatchToFirstHalf";
import { formDivergence } from "./formDivergence";
import { goalsTempoForm } from "./goalsTempoForm";
import { h2hDominance } from "./h2hDominance";
import { lineMovementVsPublic } from "./lineMovementVsPublic";
import { restCongestion } from "./restCongestion";
import { sharpSquareDetector } from "./sharpSquareDetector";
import { teamTotalsXgDc } from "./teamTotalsXgDc";
import { vigAdjustedEdge } from "./vigAdjustedEdge";
import { xGMatchupAsymmetry } from "./xGMatchupAsymmetry";
import { xPointsRegression } from "./xPointsRegression";

export const RULES: Rule[] = [
  vigAdjustedEdge,
  drawValueAt375,
  lineMovementVsPublic,
  sharpSquareDetector,
  favFullMatchToFirstHalf,
  cornersHighTempo,
  xPointsRegression,
  xGMatchupAsymmetry,
  bttsXgPoisson,
  goalsTempoForm,
  doubleChanceDcModel,
  teamTotalsXgDc,
  formDivergence,
  h2hDominance,
  restCongestion,
];

export const ruleById = (id: string): Rule | undefined =>
  RULES.find((r) => r.id === id);

export {
  bttsXgPoisson,
  cornersHighTempo,
  doubleChanceDcModel,
  drawValueAt375,
  favFullMatchToFirstHalf,
  formDivergence,
  goalsTempoForm,
  h2hDominance,
  lineMovementVsPublic,
  restCongestion,
  sharpSquareDetector,
  teamTotalsXgDc,
  vigAdjustedEdge,
  xGMatchupAsymmetry,
  xPointsRegression,
};
