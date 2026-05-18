import type { Selection } from "@/domain/market";
import type { PlayCandidate } from "@/domain/play";

export type BacktestOutcome = "WIN" | "LOSS" | "PUSH" | "VOID";

export interface ResolvedOutcome {
  outcome: BacktestOutcome;
  payoutUnits: number; // includes stake when WIN
}

export const resolveOutcome = (
  selection: Selection,
  priceDecimal: number,
  stakeUnits: number,
  fthg: number,
  ftag: number,
): ResolvedOutcome => {
  const diff = fthg - ftag; // positive => home win, negative => away win
  const total = fthg + ftag;

  switch (selection.marketKey) {
    case "ML_1X2": {
      const won =
        (selection.side === "home" && diff > 0) ||
        (selection.side === "away" && diff < 0) ||
        (selection.side === "draw" && diff === 0);
      return won
        ? { outcome: "WIN", payoutUnits: stakeUnits * priceDecimal }
        : { outcome: "LOSS", payoutUnits: 0 };
    }
    case "DNB": {
      if (diff === 0) return { outcome: "VOID", payoutUnits: stakeUnits };
      const won =
        (selection.side === "home" && diff > 0) ||
        (selection.side === "away" && diff < 0);
      return won
        ? { outcome: "WIN", payoutUnits: stakeUnits * priceDecimal }
        : { outcome: "LOSS", payoutUnits: 0 };
    }
    case "AH": {
      if (selection.line === undefined)
        return { outcome: "VOID", payoutUnits: stakeUnits };
      // line is from selection's side perspective (home positive shifts diff)
      const adjusted =
        selection.side === "home" ? diff + selection.line : -diff + selection.line;
      // For non-quarter lines: WIN > 0, LOSS < 0, PUSH == 0
      const kind = classifyLine(selection.line);
      if (kind === "quarter") {
        // Split stake between two adjacent half/whole lines
        const halfA = resolveOutcome(
          { ...selection, line: selection.line - 0.25 },
          priceDecimal,
          stakeUnits / 2,
          fthg,
          ftag,
        );
        const halfB = resolveOutcome(
          { ...selection, line: selection.line + 0.25 },
          priceDecimal,
          stakeUnits / 2,
          fthg,
          ftag,
        );
        const payout = halfA.payoutUnits + halfB.payoutUnits;
        const outcome: BacktestOutcome =
          payout > stakeUnits ? "WIN" : payout < stakeUnits ? "LOSS" : "PUSH";
        return { outcome, payoutUnits: payout };
      }
      if (Math.abs(adjusted) < 1e-9) {
        return { outcome: "PUSH", payoutUnits: stakeUnits };
      }
      return adjusted > 0
        ? { outcome: "WIN", payoutUnits: stakeUnits * priceDecimal }
        : { outcome: "LOSS", payoutUnits: 0 };
    }
    case "OU_GOALS": {
      if (selection.line === undefined)
        return { outcome: "VOID", payoutUnits: stakeUnits };
      const isOver = selection.side === "over";
      const kind = classifyLine(selection.line);
      if (kind === "quarter") {
        const halfA = resolveOutcome(
          { ...selection, line: selection.line - 0.25 },
          priceDecimal,
          stakeUnits / 2,
          fthg,
          ftag,
        );
        const halfB = resolveOutcome(
          { ...selection, line: selection.line + 0.25 },
          priceDecimal,
          stakeUnits / 2,
          fthg,
          ftag,
        );
        const payout = halfA.payoutUnits + halfB.payoutUnits;
        const outcome: BacktestOutcome =
          payout > stakeUnits ? "WIN" : payout < stakeUnits / 2 ? "LOSS" : "PUSH";
        return { outcome, payoutUnits: payout };
      }
      if (Math.abs(total - selection.line) < 1e-9) {
        return { outcome: "PUSH", payoutUnits: stakeUnits };
      }
      const won = isOver ? total > selection.line : total < selection.line;
      return won
        ? { outcome: "WIN", payoutUnits: stakeUnits * priceDecimal }
        : { outcome: "LOSS", payoutUnits: 0 };
    }
    case "BTTS": {
      const bttsYes = fthg > 0 && ftag > 0;
      const won =
        (selection.side === "yes" && bttsYes) ||
        (selection.side === "no" && !bttsYes);
      return won
        ? { outcome: "WIN", payoutUnits: stakeUnits * priceDecimal }
        : { outcome: "LOSS", payoutUnits: 0 };
    }
    case "DC": {
      const dcWon =
        (selection.side === "1X" && diff >= 0) ||
        (selection.side === "X2" && diff <= 0) ||
        (selection.side === "12" && diff !== 0);
      return dcWon
        ? { outcome: "WIN", payoutUnits: stakeUnits * priceDecimal }
        : { outcome: "LOSS", payoutUnits: 0 };
    }
    case "TTG_HOME":
    case "TTG_AWAY": {
      if (selection.line === undefined)
        return { outcome: "VOID", payoutUnits: stakeUnits };
      const teamGoals = selection.marketKey === "TTG_HOME" ? fthg : ftag;
      const isOver = selection.side === "over";
      if (Math.abs(teamGoals - selection.line) < 1e-9) {
        return { outcome: "PUSH", payoutUnits: stakeUnits };
      }
      const won = isOver ? teamGoals > selection.line : teamGoals < selection.line;
      return won
        ? { outcome: "WIN", payoutUnits: stakeUnits * priceDecimal }
        : { outcome: "LOSS", payoutUnits: 0 };
    }
    default:
      return { outcome: "VOID", payoutUnits: stakeUnits };
  }
};

export const resolvePlayOutcome = (
  play: PlayCandidate,
  fthg: number,
  ftag: number,
): ResolvedOutcome =>
  resolveOutcome(
    play.selection,
    play.price.decimal,
    Math.max(play.stakeUnits, 1),
    fthg,
    ftag,
  );

const classifyLine = (line: number): "whole" | "half" | "quarter" => {
  const q = Math.abs(Math.round(line * 4));
  if (q % 4 === 0) return "whole";
  if (q % 2 === 0) return "half";
  return "quarter";
};
