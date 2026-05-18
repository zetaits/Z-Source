import type { Rule, RuleOutput } from "../types";

const MIN_MEETINGS = 4;
const DIFF_MIN = 0.4;
const BASE_STRENGTH = 0.2;
const STRENGTH_PER_EXCESS = 0.5;
const MAX_STRENGTH = 0.5;

const PATTERN_THRESHOLD = 0.8;
const PATTERN_BASE = 0.2;
const PATTERN_SCALE = 0.5;
const PATTERN_MAX = 0.45;

const alignmentForSide = (side: string, delta: number): boolean | null => {
  if (side === "home") return delta > 0;
  if (side === "away") return delta < 0;
  return null;
};

export const h2hDominance: Rule = {
  id: "h2h-dominance",
  description:
    "One-sided H2H records tilt outright markets toward the dominant club; consistent goal/BTTS patterns over recent H2H meetings tilt totals and BTTS.",
  markets: ["ML_1X2", "DNB", "AH", "OU_GOALS", "BTTS"],
  leg: "matchup",
  defaultWeight: 0.8,
  run: ({ ctx, selection, config }): RuleOutput | null => {
    const h2h = ctx.h2h;
    if (!h2h) return null;
    const total = h2h.meetings.length;
    if (total < MIN_MEETINGS) return null;

    const marketKey = selection.marketKey;

    if (marketKey === "OU_GOALS") {
      if (selection.line === undefined) return null;
      const overCount = h2h.meetings.filter(
        (m) => m.goalsFor + m.goalsAgainst > selection.line!,
      ).length;
      const overRate = overCount / total;
      const consistentOver = overRate >= PATTERN_THRESHOLD;
      const consistentUnder = overRate <= 1 - PATTERN_THRESHOLD;
      if (!consistentOver && !consistentUnder) return null;

      const wantsOver = selection.side === "over";
      const aligned = (consistentOver && wantsOver) || (consistentUnder && !wantsOver);
      const magnitude = Math.min(
        PATTERN_BASE + Math.abs(overRate - 0.5) * PATTERN_SCALE,
        PATTERN_MAX,
      );
      const strength = aligned ? magnitude : -magnitude;
      return {
        ruleId: "h2h-dominance",
        leg: "matchup",
        verdict: aligned ? "SUPPORT" : "AGAINST",
        strength,
        weight: config.weight,
        message: `H2H Over ${selection.line} rate ${(overRate * 100).toFixed(0)}% over ${total} meetings`,
        data: { overRate, meetings: total, line: selection.line, pattern: "goals" },
      };
    }

    if (marketKey === "BTTS") {
      const yesCount = h2h.meetings.filter(
        (m) => m.goalsFor > 0 && m.goalsAgainst > 0,
      ).length;
      const yesRate = yesCount / total;
      const consistentYes = yesRate >= PATTERN_THRESHOLD;
      const consistentNo = yesRate <= 1 - PATTERN_THRESHOLD;
      if (!consistentYes && !consistentNo) return null;

      const wantsYes = selection.side === "yes";
      const aligned = (consistentYes && wantsYes) || (consistentNo && !wantsYes);
      const magnitude = Math.min(
        PATTERN_BASE + Math.abs(yesRate - 0.5) * PATTERN_SCALE,
        PATTERN_MAX,
      );
      const strength = aligned ? magnitude : -magnitude;
      return {
        ruleId: "h2h-dominance",
        leg: "matchup",
        verdict: aligned ? "SUPPORT" : "AGAINST",
        strength,
        weight: config.weight,
        message: `H2H BTTS rate ${(yesRate * 100).toFixed(0)}% over ${total} meetings`,
        data: { yesRate, meetings: total, pattern: "btts" },
      };
    }

    const homeRate = h2h.homeWins / total;
    const awayRate = h2h.awayWins / total;
    const delta = homeRate - awayRate;
    if (Math.abs(delta) < DIFF_MIN) return null;

    const aligned = alignmentForSide(selection.side, delta);
    if (aligned === null) return null;

    const excess = Math.abs(delta) - DIFF_MIN;
    const magnitude = Math.min(
      BASE_STRENGTH + excess * STRENGTH_PER_EXCESS,
      MAX_STRENGTH,
    );
    const strength = aligned ? magnitude : -magnitude;
    const dominantSide = delta > 0 ? "home" : "away";

    return {
      ruleId: "h2h-dominance",
      leg: "matchup",
      verdict: aligned ? "SUPPORT" : "AGAINST",
      strength,
      weight: config.weight,
      message: `H2H ${h2h.homeWins}W-${h2h.draws}D-${h2h.awayWins}L over ${total} meetings · ${dominantSide} dominant`,
      data: {
        homeWins: h2h.homeWins,
        awayWins: h2h.awayWins,
        draws: h2h.draws,
        meetings: total,
        delta,
        dominantSide,
        pattern: "winrate",
      },
    };
  },
};
