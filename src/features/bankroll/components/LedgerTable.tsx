import type { LedgerEntry } from "@/domain/bankroll";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney, formatSignedMoney } from "@/lib/money";

const KIND_LABEL: Record<LedgerEntry["kind"], string> = {
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  BET_STAKE: "Bet stake",
  BET_RESULT: "Bet result",
  ADJUSTMENT: "Adjustment",
};

interface Props {
  entries: LedgerEntry[];
  currency: string;
}

export function LedgerTable({ entries, currency }: Props) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        No ledger entries yet.
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-40">When</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Balance</TableHead>
            <TableHead>Note</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) => {
            const signTone =
              e.amountMinor > 0
                ? "text-[hsl(var(--success))]"
                : e.amountMinor < 0
                  ? "text-destructive"
                  : "";
            return (
              <TableRow key={e.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {new Date(e.occurredAt).toLocaleString()}
                </TableCell>
                <TableCell className="text-sm">{KIND_LABEL[e.kind]}</TableCell>
                <TableCell className={`text-right font-mono tabular-nums ${signTone}`}>
                  {formatSignedMoney(e.amountMinor, currency)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatMoney(e.balanceAfterMinor, currency)}
                </TableCell>
                <TableCell className="max-w-sm truncate text-xs text-muted-foreground">
                  {e.note ?? (e.betId ? `bet ${String(e.betId).slice(0, 8)}…` : "—")}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
