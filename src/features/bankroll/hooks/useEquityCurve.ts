import { useMemo } from "react";
import type { LedgerEntry } from "@/domain/bankroll";

export interface EquityPoint {
  t: number;
  label: string;
  balanceMinor: number;
}

export const useEquityCurve = (ledger: LedgerEntry[] | undefined): EquityPoint[] => {
  return useMemo(() => {
    if (!ledger || ledger.length === 0) return [];
    const asc = [...ledger].sort(
      (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
    );
    return asc.map((e) => ({
      t: new Date(e.occurredAt).getTime(),
      label: new Date(e.occurredAt).toLocaleDateString(),
      balanceMinor: e.balanceAfterMinor,
    }));
  }, [ledger]);
};
