import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Bet, BetStatus } from "@/domain/bet";
import type { BetId } from "@/domain/ids";
import { betsRepo } from "@/storage/repos/betsRepo";
import { bankrollRepo } from "@/storage/repos/bankrollRepo";
import { pickOutcomesRepo } from "@/storage/repos/pickOutcomesRepo";
import { isPersistentStorage } from "@/storage";
import { settleBetCore } from "../settleBet";
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
      if (bet.playSnapshot) {
        await pickOutcomesRepo
          .insertFromPlay(bet.playSnapshot, bet.leagueId, bet.id)
          .catch(() => {});
      }
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
      return settleBetCore(bet, input.status);
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
