// Pure decision helpers for the autopilot loop — no React, no I/O, so the
// settle-grading and timing logic is unit-testable in isolation. The effectful
// orchestration (fetching, logging, settling on an interval) lives in
// useAutopilot.ts and composes these.

import type { Bet, BetStatus } from "@/domain/bet";

/** Minutes before scheduled first pitch to capture the Bet365 closing line. */
export const CLOSE_LEAD_MINUTES = 10;

/**
 * Grade an over/under strikeout bet against the pitcher's realised K count.
 * Half-lines (4.5, 5.5…) never push; an integer line pushes on an exact match.
 */
export const gradeKs = (
  side: string,
  line: number,
  ks: number,
): Exclude<BetStatus, "OPEN" | "VOID" | "CASHOUT"> => {
  if (ks === line) return "PUSH";
  if (side === "over") return ks > line ? "WON" : "LOST";
  if (side === "under") return ks < line ? "WON" : "LOST";
  // Unknown side — treat as void-ish PUSH so we never mis-grade a win/loss.
  return "PUSH";
};

/**
 * Has the closing-line capture window opened? True once now is within
 * CLOSE_LEAD_MINUTES of the scheduled start (or already past it). Undefined
 * start time → false (we can't time it, so skip rather than guess).
 */
export const closeWindowReached = (
  startTimeIso: string | undefined,
  nowMs: number,
  leadMinutes: number = CLOSE_LEAD_MINUTES,
): boolean => {
  if (!startTimeIso) return false;
  const start = Date.parse(startTimeIso);
  if (Number.isNaN(start)) return false;
  return nowMs >= start - leadMinutes * 60_000;
};

/** Is this an OPEN baseball pitcher-K bet that the autopilot can act on? */
export const isAutopilotBet = (bet: Bet): boolean =>
  bet.status === "OPEN" &&
  bet.marketKey === "PITCHER_KS" &&
  bet.playSnapshot?.settleRef !== undefined;
