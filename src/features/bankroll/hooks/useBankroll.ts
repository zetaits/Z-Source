import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BankrollSettings, LedgerEntry, LedgerKind } from "@/domain/bankroll";
import type { BetId } from "@/domain/ids";
import { bankrollRepo } from "@/storage/repos/bankrollRepo";
import { isPersistentStorage } from "@/storage";

const QK = {
  settings: ["bankroll", "settings"] as const,
  ledger: ["bankroll", "ledger"] as const,
  balance: ["bankroll", "balance"] as const,
};

export const useBankrollSettings = () =>
  useQuery({
    queryKey: QK.settings,
    queryFn: () => bankrollRepo.loadSettings(),
    enabled: isPersistentStorage(),
    staleTime: Infinity,
  });

export const useLedger = (limit = 500) =>
  useQuery({
    queryKey: [...QK.ledger, limit] as const,
    queryFn: () => bankrollRepo.listLedger(limit),
    enabled: isPersistentStorage(),
  });

export const useCurrentBalance = () =>
  useQuery({
    queryKey: QK.balance,
    queryFn: () => bankrollRepo.currentBalanceMinor(),
    enabled: isPersistentStorage(),
  });

export const invalidateBankroll = (qc: ReturnType<typeof useQueryClient>) => {
  void qc.invalidateQueries({ queryKey: QK.ledger });
  void qc.invalidateQueries({ queryKey: QK.balance });
};

export const useSaveBankrollSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (next: BankrollSettings) => {
      await bankrollRepo.saveSettings(next);
      return next;
    },
    onSuccess: (next) => {
      qc.setQueryData(QK.settings, next);
    },
  });
};

export const useAppendLedger = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: {
      kind: LedgerKind;
      amountMinor: number;
      betId?: BetId;
      note?: string;
    }) => bankrollRepo.append(opts),
    onSuccess: (entry: LedgerEntry) => {
      qc.setQueryData<LedgerEntry[]>([...QK.ledger, 500], (prev) =>
        prev ? [entry, ...prev] : [entry],
      );
      qc.setQueryData<number>(QK.balance, entry.balanceAfterMinor);
    },
  });
};

export const useResetBankroll = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (startingMinor: number) => bankrollRepo.reset(startingMinor),
    onSuccess: () => {
      invalidateBankroll(qc);
    },
  });
};
