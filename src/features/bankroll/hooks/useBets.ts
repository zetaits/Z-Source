import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Bet, BetStatus } from "@/domain/bet";
import type { BetId } from "@/domain/ids";
import { betsRepo } from "@/storage/repos/betsRepo";
import { bankrollRepo } from "@/storage/repos/bankrollRepo";
import { snapshotsRepo } from "@/storage/repos/snapshotsRepo";
import { isPersistentStorage } from "@/storage";
import { invalidateBankroll } from "./useBankroll";

const QK_BETS = ["bets", "list"] as const;
const QK_EXPOSURE = ["bankroll", "exposure"] as const;

export const useBets = (opts: { status?: BetStatus; limit?: number } = {}) =>
  useQuery({
    queryKey: [...QK_BETS, opts.status ?? "ALL", opts.limit ?? 500] as const,
    queryFn: () => betsRepo.list(opts),
    enabled: isPersistentStorage(),
  });

export const useOpenExposure = () =>
  useQuery({
    queryKey: QK_EXPOSURE,
    queryFn: () => bankrollRepo.openExposureMinor(),
    enabled: isPersistentStorage(),
  });

const invalidateBets = (qc: ReturnType<typeof useQueryClient>) => {
  void qc.invalidateQueries({ queryKey: QK_BETS });
  void qc.invalidateQueries({ queryKey: QK_EXPOSURE });
};

export const useLogBet = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bet: Bet) => {
      await betsRepo.insert(bet);
      return bet;
    },
    onSuccess: () => {
      invalidateBets(qc);
    },
  });
};

export interface SettleInput {
  id: BetId;
  status: Exclude<BetStatus, "OPEN">;
}

export const useSettleBet = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SettleInput) => {
      const bet = await betsRepo.get(input.id);
      if (!bet) throw new Error("Bet not found");
      if (bet.status !== "OPEN") throw new Error("Bet is already settled");
      const pnlMinor = computePnlMinor(bet.stakeMinor, bet.priceDecimal, input.status);
      const payoutMinor = bet.stakeMinor + pnlMinor;
      await betsRepo.settle({ id: input.id, status: input.status, payoutMinor });
      if (bet.closingPriceDecimal === undefined) {
        const snap = await snapshotsRepo
          .latestFor(bet.matchId, bet.marketKey, bet.selection)
          .catch(() => null);
        if (snap) {
          await betsRepo.setClosingPrice(bet.id, snap.priceDecimal).catch(() => {});
        }
      }
      await bankrollRepo.append({
        kind: "BET_RESULT",
        amountMinor: pnlMinor,
        betId: input.id,
        note: `Settled ${input.status}`,
      });
      return { pnlMinor };
    },
    onSuccess: () => {
      invalidateBets(qc);
      invalidateBankroll(qc);
    },
  });
};

export const useReopenBet = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: BetId) => {
      const bet = await betsRepo.get(id);
      if (!bet) throw new Error("Bet not found");
      if (bet.status === "OPEN") throw new Error("Bet is already open");
      await bankrollRepo.deleteForBet(id);
      await betsRepo.reopen(id);
    },
    onSuccess: () => {
      invalidateBets(qc);
      invalidateBankroll(qc);
    },
  });
};

export const useDeleteBet = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: BetId) => {
      await bankrollRepo.deleteForBet(id);
      await betsRepo.delete(id);
    },
    onSuccess: () => {
      invalidateBets(qc);
      invalidateBankroll(qc);
    },
  });
};

export const useUpdateBet = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bet: Bet) => {
      const existing = await betsRepo.get(bet.id);
      if (!existing) throw new Error("Bet not found");
      if (existing.status !== "OPEN") {
        throw new Error("Reopen the bet before editing it");
      }
      await betsRepo.update(bet);
      return bet;
    },
    onSuccess: () => {
      invalidateBets(qc);
    },
  });
};

const computePnlMinor = (
  stakeMinor: number,
  priceDecimal: number,
  status: Exclude<BetStatus, "OPEN">,
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
