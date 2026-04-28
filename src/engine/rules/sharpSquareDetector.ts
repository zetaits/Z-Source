import { selectionKey } from "@/domain/market";
import { offersForMarket } from "../markets/shared";
import type { Rule, RuleOutput } from "../types";

type Pattern =
  | "REVERSE_LINE_MOVEMENT"
  | "PUBLIC_DOG_TRAP_CONFIRMED"
  | "SHARP_MONEY_DIVERGENCE"
  | "HEAVY_PUBLIC_NO_DIVERGENCE"
  | "PURE_FADE_PUBLIC";

const RLM_MAX_BETS_PCT = 40;
const RLM_MIN_SHIFT = -0.03;
const DOG_MIN_BETS = 60;
const DOG_MIN_MONEY = 55;
const DOG_LINE_STABLE = -0.005;
const DIVERGENCE_MIN_DELTA = 15;
const HEAVY_PUBLIC_MIN = 70;
const HEAVY_NO_DIV_MAX_DELTA = 10;
const HEAVY_NO_DIV_MAX_SHIFT = 0.01;
const FADE_MIN_BETS = 80;
const FADE_MAX_SHIFT = 0.01;

export const sharpSquareDetector: Rule = {
  id: "sharp-square-detector",
  description:
    "Unified sharp-vs-square pattern detector: RLM, sharp money divergence, public dog trap, pure fade.",
  markets: ["ML_1X2", "DNB", "BTTS", "OU_GOALS", "AH", "CORNERS_TOTAL"],
  leg: "sharpVsSquare",
  defaultWeight: 1,
  run: ({ ctx, selection, price, config }): RuleOutput | null => {
    const splits = ctx.splits[selection.marketKey];
    if (!splits) return null;

    const key = selectionKey(selection);
    const row = splits.rows.find((r) => selectionKey(r.selection) === key);
    if (!row || row.betsPct === undefined) return null;

    const { betsPct, moneyPct } = row;

    const opener = ctx.openers[selection.marketKey];
    const openerOffer = opener?.offers
      .filter((o) => selectionKey(o.selection) === key)
      .sort((a, b) => b.decimal - a.decimal)[0];
    const shiftPct =
      openerOffer !== undefined
        ? (price.decimal - openerOffer.decimal) / openerOffer.decimal
        : null;

    const scopedOffers = offersForMarket(ctx, selection.marketKey).filter((o) =>
      selection.line === undefined ? true : o.selection.line === selection.line,
    );
    const minDecimal =
      scopedOffers.length > 0
        ? scopedOffers.reduce((mn, o) => Math.min(mn, o.decimal), Infinity)
        : Infinity;
    const isUnderdog = price.decimal > minDecimal;

    const emit = (
      pattern: Pattern,
      leg: RuleOutput["leg"],
      verdict: RuleOutput["verdict"],
      strength: number,
      message: string,
    ): RuleOutput => ({
      ruleId: "sharp-square-detector",
      leg,
      verdict,
      strength,
      weight: config.weight,
      message,
      data: { pattern, betsPct, moneyPct, shiftPct, isUnderdog, price: price.decimal },
    });

    // 1. REVERSE_LINE_MOVEMENT — few public tickets but line shortened
    if (betsPct <= RLM_MAX_BETS_PCT && shiftPct !== null && shiftPct <= RLM_MIN_SHIFT) {
      const strength = Math.min(0.4 + Math.abs(shiftPct) * 3, 0.7);
      return emit(
        "REVERSE_LINE_MOVEMENT",
        "lines",
        "SUPPORT",
        strength,
        `RLM: ${betsPct}% tickets but line shortened ${(shiftPct * 100).toFixed(1)}% · sharp action`,
      );
    }

    // 2. PUBLIC_DOG_TRAP_CONFIRMED — public heavy on underdog, book not moving line
    if (isUnderdog) {
      const publicHeavy =
        betsPct >= DOG_MIN_BETS || (moneyPct !== undefined && moneyPct >= DOG_MIN_MONEY);
      const lineStable = shiftPct === null || shiftPct >= DOG_LINE_STABLE;
      if (publicHeavy && lineStable) {
        const heavyVal = Math.max(betsPct, moneyPct ?? 0);
        const strength = -(0.4 + Math.min((heavyVal - 55) / 50, 0.2));
        return emit(
          "PUBLIC_DOG_TRAP_CONFIRMED",
          "sharpVsSquare",
          "AGAINST",
          strength,
          `Dog trap @ ${price.decimal.toFixed(2)}: ${betsPct}% tickets${moneyPct !== undefined ? ` / ${moneyPct}% money` : ""} · book not dropping line`,
        );
      }
    }

    // 3. SHARP_MONEY_DIVERGENCE — money % exceeds tickets % ≥15 pts, line confirms
    if (moneyPct !== undefined) {
      const delta = moneyPct - betsPct;
      if (delta >= DIVERGENCE_MIN_DELTA && (shiftPct === null || shiftPct <= 0)) {
        const strength = 0.3 + Math.min((delta - DIVERGENCE_MIN_DELTA) / 50, 0.2);
        return emit(
          "SHARP_MONEY_DIVERGENCE",
          "sharpVsSquare",
          "SUPPORT",
          strength,
          `Money ${moneyPct}% vs tickets ${betsPct}% (Δ +${delta.toFixed(0)}) · sharp-side divergence`,
        );
      }
    }

    // 4. HEAVY_PUBLIC_NO_DIVERGENCE — real consensus, silence the fade
    if (
      betsPct >= HEAVY_PUBLIC_MIN &&
      moneyPct !== undefined &&
      Math.abs(moneyPct - betsPct) < HEAVY_NO_DIV_MAX_DELTA &&
      (shiftPct === null || Math.abs(shiftPct) < HEAVY_NO_DIV_MAX_SHIFT)
    ) {
      return null;
    }

    // 5. PURE_FADE_PUBLIC — very heavy public tickets, weak fallback signal
    if (betsPct >= FADE_MIN_BETS && (shiftPct === null || Math.abs(shiftPct) < FADE_MAX_SHIFT)) {
      const strength = -(0.2 + Math.min((betsPct - FADE_MIN_BETS) / 100, 0.15));
      return emit(
        "PURE_FADE_PUBLIC",
        "sharpVsSquare",
        "AGAINST",
        strength,
        `${betsPct}% public tickets on this side · pure ticket fade (weak)`,
      );
    }

    return null;
  },
};
