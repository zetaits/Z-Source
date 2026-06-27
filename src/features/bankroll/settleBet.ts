// Shared settle orchestration, extracted from useSettleBet so the autopilot can
// settle bets through the EXACT same path (payout math, closing-line capture,
// pick-outcome mirror, bankroll ledger entry) as a manual settle. Pure DB/repo
// calls — no React — so both the mutation hook and the autopilot loop reuse it.

import type { Bet, BetStatus } from "@/domain/bet";
import { betsRepo } from "@/storage/repos/betsRepo";
import { bankrollRepo } from "@/storage/repos/bankrollRepo";
import {
  pickOutcomesRepo,
  type PickOutcomeStatus,
} from "@/storage/repos/pickOutcomesRepo";
import { snapshotsRepo } from "@/storage/repos/snapshotsRepo";

type SettledStatus = Exclude<BetStatus, "OPEN">;

export const betToPickOutcomeStatus = (s: SettledStatus): PickOutcomeStatus => {
  switch (s) {
    case "WON":
      return "WIN";
    case "LOST":
      return "LOSS";
    case "PUSH":
      return "PUSH";
    case "VOID":
    case "CASHOUT":
      return "VOID";
  }
};

export const payoutUnitsFor = (
  status: SettledStatus,
  stakeUnits: number,
  priceDecimal: number,
): number => {
  switch (status) {
    case "WON":
      return stakeUnits * priceDecimal;
    case "LOST":
      return 0;
    case "PUSH":
    case "VOID":
    case "CASHOUT":
      return stakeUnits;
  }
};

export const computePnlMinor = (
  stakeMinor: number,
  priceDecimal: number,
  status: SettledStatus,
): number => {
  switch (status) {
    case "WON":
      return Math.round(stakeMinor * (priceDecimal - 1));
    case "LOST":
      return -stakeMinor;
    case "PUSH":
    case "VOID":
    case "CASHOUT":
      return 0;
  }
};

/**
 * Settle a single OPEN bet: write status + payout, record the realised result
 * (for calibration), mirror the pick outcome, lazily capture the closing line,
 * and append the bankroll ledger entry. Returns the realised P/L in minor units.
 * Caller is responsible for the OPEN-status precondition and cache invalidation.
 */
export const settleBetCore = async (
  bet: Bet,
  status: SettledStatus,
  opts: { actualResult?: number } = {},
): Promise<{ pnlMinor: number }> => {
  const pnlMinor = computePnlMinor(bet.stakeMinor, bet.priceDecimal, status);
  const payoutMinor = bet.stakeMinor + pnlMinor;
  await betsRepo.settle({ id: bet.id, status, payoutMinor });

  if (opts.actualResult !== undefined) {
    await betsRepo.setActualResult(bet.id, opts.actualResult).catch(() => {});
  }

  await pickOutcomesRepo
    .mirrorFromBet(
      bet.id,
      betToPickOutcomeStatus(status),
      payoutUnitsFor(status, bet.stakeUnits, bet.priceDecimal),
    )
    .catch(() => {});

  if (bet.closingPriceDecimal === undefined) {
    // Use the play snapshot's selection when present: for player props it
    // carries `player`, so selectionKey matches the |player-tagged odds
    // snapshots persisted during analyze() (without it, latestFor never matches
    // and CLV stays pending forever). Football has no player on the selection,
    // so the key — and behaviour — is byte-identical.
    const closingSelection = bet.playSnapshot?.selection ?? bet.selection;
    // Only a snapshot taken AFTER the bet was placed counts as a genuine close.
    // If the app was closed through the closing window, the only snapshot is the
    // entry one (taken at/before placedAt) — we skip it so CLV stays N/A rather
    // than a misleading 0%, distinguishing "never captured" from "line held".
    const snap = await snapshotsRepo
      .latestFor(bet.matchId, bet.marketKey, closingSelection, { after: bet.placedAt })
      .catch(() => null);
    if (snap) {
      await betsRepo.setClosingPrice(bet.id, snap.priceDecimal).catch(() => {});
    }
  }

  await bankrollRepo.append({
    kind: "BET_RESULT",
    amountMinor: pnlMinor,
    betId: bet.id,
    note: `Settled ${status}`,
  });

  return { pnlMinor };
};
