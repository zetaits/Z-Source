import { selectionKey } from "@/domain/market";
import type { Rule, RuleOutput } from "../types";

const HEAVY_PUBLIC_THRESHOLD = 75;

export const fadeThePublic: Rule = {
  id: "fade-the-public",
  description:
    "Fade selections with heavy public backing (≥75% of tickets). The public over-prices popular sides.",
  markets: ["ML_1X2", "DNB", "BTTS", "OU_GOALS", "AH", "CORNERS_TOTAL"],
  leg: "sharpVsSquare",
  defaultWeight: 1,
  run: ({ ctx, selection, config }): RuleOutput | null => {
    const splits = ctx.splits[selection.marketKey];
    if (!splits) return null;
    const scopedRows =
      selection.line !== undefined
        ? splits.rows.filter((r) => r.selection.line === selection.line)
        : splits.rows;
    if (scopedRows.length === 0) return null;
    const key = selectionKey(selection);
    const publicHeavy = scopedRows.find(
      (r) => (r.betsPct ?? 0) >= HEAVY_PUBLIC_THRESHOLD,
    );
    if (!publicHeavy) return null;
    const heavyKey = selectionKey(publicHeavy.selection);
    if (heavyKey === key) {
      const strength = -Math.min(
        0.25 + ((publicHeavy.betsPct! - HEAVY_PUBLIC_THRESHOLD) / 100) * 2,
        0.6,
      );
      return {
        ruleId: "fade-the-public",
        leg: "sharpVsSquare",
        verdict: "AGAINST",
        strength,
        weight: config.weight,
        message: `Public on ${publicHeavy.betsPct}% of tickets · heavy square side`,
        data: { publicPct: publicHeavy.betsPct },
      };
    }
    if (scopedRows.length === 2) {
      const strength = Math.min(
        0.25 + ((publicHeavy.betsPct! - HEAVY_PUBLIC_THRESHOLD) / 100) * 2,
        0.6,
      );
      return {
        ruleId: "fade-the-public",
        leg: "sharpVsSquare",
        verdict: "SUPPORT",
        strength,
        weight: config.weight,
        message: `Public ${publicHeavy.betsPct}% on the other side · fade-the-public support`,
        data: { publicPct: publicHeavy.betsPct, heavySide: publicHeavy.selection.side },
      };
    }
    return null;
  },
};
