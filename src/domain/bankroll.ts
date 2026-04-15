import type { BetId } from "./ids";

export type LedgerKind =
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "BET_STAKE"
  | "BET_RESULT"
  | "ADJUSTMENT";

export interface LedgerEntry {
  id: number;
  occurredAt: string;
  kind: LedgerKind;
  amountMinor: number;
  balanceAfterMinor: number;
  betId?: BetId;
  note?: string;
}

export interface BankrollSettings {
  currency: string;
  unitValueMinor: number;
  startingBankrollMinor: number;
}

export interface BankrollSnapshot {
  balanceMinor: number;
  unitValueMinor: number;
  units: number;
  currency: string;
  updatedAt: string;
}
