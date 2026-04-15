import type { Rule } from "../types";
import { cornersHighTempo } from "./cornersHighTempo";
import { drawValueAt375 } from "./drawValueAt375";
import { fadeThePublic } from "./fadeThePublic";
import { favFullMatchToFirstHalf } from "./favFullMatchToFirstHalf";
import { formDivergence } from "./formDivergence";
import { h2hDominance } from "./h2hDominance";
import { lineMovementVsPublic } from "./lineMovementVsPublic";
import { publicUnderdogTrap } from "./publicUnderdogTrap";
import { restCongestion } from "./restCongestion";
import { sharpMoneyAgainstPublic } from "./sharpMoneyAgainstPublic";
import { vigAdjustedEdge } from "./vigAdjustedEdge";

export const RULES: Rule[] = [
  vigAdjustedEdge,
  drawValueAt375,
  lineMovementVsPublic,
  favFullMatchToFirstHalf,
  fadeThePublic,
  publicUnderdogTrap,
  sharpMoneyAgainstPublic,
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
  fadeThePublic,
  favFullMatchToFirstHalf,
  formDivergence,
  h2hDominance,
  lineMovementVsPublic,
  publicUnderdogTrap,
  restCongestion,
  sharpMoneyAgainstPublic,
  vigAdjustedEdge,
};
