import type { Rule, RuleOutput } from "../types";
import { clamp } from "../ev";

const BTTS_BASELINE_TEMPO = 2.6;
const STRENGTH_SCALE = 0.18;
const MAX_STRENGTH = 0.45;
const MIN_DELTA = 0.25;

export const goalsTempoForm: Rule = {
  id: "goals-tempo-form",
  description:
    "Recent goal-tempo (goalsFor+goalsAgainst per game) of both clubs vs OU line / BTTS baseline; supports Over/Under or BTTS Yes/No accordingly.",
  markets: ["OU_GOALS", "BTTS"],
  leg: "trends",
  defaultWeight: 0.85,
  run: ({ ctx, selection, config }): RuleOutput | null => {
    const home = ctx.homeForm;
    const away = ctx.awayForm;
    if (!home || !away) return null;
    if (home.lastN === 0 || away.lastN === 0) return null;

    const homeTempo = (home.goalsFor + home.goalsAgainst) / home.lastN;
    const awayTempo = (away.goalsFor + away.goalsAgainst) / away.lastN;
    const combined = (homeTempo + awayTempo) / 2;

    let baseline: number;
    if (selection.marketKey === "OU_GOALS") {
      if (selection.line === undefined) return null;
      baseline = selection.line;
    } else {
      baseline = BTTS_BASELINE_TEMPO;
    }

    const delta = combined - baseline;
    if (Math.abs(delta) < MIN_DELTA) return null;

    let wantsHighTempo: boolean;
    if (selection.marketKey === "OU_GOALS") {
      wantsHighTempo = selection.side === "over";
    } else {
      wantsHighTempo = selection.side === "yes";
    }

    const aligned = (delta > 0 && wantsHighTempo) || (delta < 0 && !wantsHighTempo);
    const magnitude = clamp(Math.abs(delta) * STRENGTH_SCALE, 0, MAX_STRENGTH);
    const strength = aligned ? magnitude : -magnitude;

    return {
      ruleId: "goals-tempo-form",
      leg: "trends",
      verdict: aligned ? "SUPPORT" : "AGAINST",
      strength,
      weight: config.weight,
      message: `Combined goal tempo ${combined.toFixed(2)} vs baseline ${baseline.toFixed(2)} · ${aligned ? "backs" : "fades"} ${selection.side}`,
      data: { homeTempo, awayTempo, combined, baseline, delta },
    };
  },
};
