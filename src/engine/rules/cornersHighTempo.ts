import type { Rule, RuleOutput } from "../types";

const BASELINE_TEMPO = 2.6;
const MAX_SHIFT = 0.35;

export const cornersHighTempo: Rule = {
  id: "corners-high-tempo",
  description:
    "High-tempo sides (goals-for + goals-against per game) correlate with corner production. Support Over when combined tempo is above baseline; support Under when below.",
  markets: ["CORNERS_TOTAL"],
  leg: "trends",
  defaultWeight: 0.9,
  run: ({ ctx, selection, config }): RuleOutput | null => {
    const { homeForm, awayForm } = ctx;
    if (!homeForm || !awayForm) return null;
    if (homeForm.lastN === 0 || awayForm.lastN === 0) return null;

    const homeTempo = (homeForm.goalsFor + homeForm.goalsAgainst) / homeForm.lastN;
    const awayTempo = (awayForm.goalsFor + awayForm.goalsAgainst) / awayForm.lastN;
    const combined = (homeTempo + awayTempo) / 2;
    const delta = combined - BASELINE_TEMPO;
    if (Math.abs(delta) < 0.2) return null;

    const wantOver = selection.side === "over";
    const aligned = (delta > 0 && wantOver) || (delta < 0 && !wantOver);
    const strength = Math.min(Math.abs(delta) * 0.25, MAX_SHIFT);

    return {
      ruleId: "corners-high-tempo",
      leg: "trends",
      verdict: aligned ? "SUPPORT" : "AGAINST",
      strength,
      weight: config.weight,
      message: `Combined tempo ${combined.toFixed(2)} vs baseline ${BASELINE_TEMPO.toFixed(2)} · ${aligned ? "backs" : "against"} ${selection.side}`,
      data: { homeTempo, awayTempo, combined, baseline: BASELINE_TEMPO, delta },
    };
  },
};
