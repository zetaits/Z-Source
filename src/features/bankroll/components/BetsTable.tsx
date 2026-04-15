import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import type { Bet, BetStatus } from "@/domain/bet";
import type { BankrollSettings } from "@/domain/bankroll";
import { clvPct, profitMinor } from "@/domain/bet";
import { marketByKey } from "@/config/markets";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney, formatSignedMoney } from "@/lib/money";
import { useDeleteBet, useReopenBet, useSettleBet } from "../hooks/useBets";
import { BetEntryDialog } from "./BetEntryDialog";

const STATUS_TONE: Record<BetStatus, string> = {
  OPEN: "border-primary/40 bg-primary/15 text-primary",
  WON: "border-[hsl(var(--success))]/40 bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]",
  LOST: "border-destructive/40 bg-destructive/15 text-destructive",
  PUSH: "border-border bg-muted text-muted-foreground",
  VOID: "border-border bg-muted text-muted-foreground",
  CASHOUT: "border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]",
};

interface Props {
  bets: Bet[];
  bankroll: BankrollSettings;
}

export function BetsTable({ bets, bankroll }: Props) {
  const settle = useSettleBet();
  const reopen = useReopenBet();
  const remove = useDeleteBet();
  const [editing, setEditing] = useState<Bet | null>(null);
  const [reopenTarget, setReopenTarget] = useState<Bet | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Bet | null>(null);

  if (bets.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">No bets logged yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Use “Log bet” above to add your first play. The bankroll only moves when you settle.
        </p>
      </div>
    );
  }

  const onSettle = async (bet: Bet, status: Exclude<BetStatus, "OPEN">) => {
    try {
      await settle.mutateAsync({ id: bet.id, status });
      toast.success(`Settled ${status}`);
    } catch (err) {
      toast.error(`Failed: ${(err as Error).message}`);
    }
  };

  const onReopen = async () => {
    if (!reopenTarget) return;
    try {
      await reopen.mutateAsync(reopenTarget.id);
      toast.success("Bet reopened. Ledger reversed.");
      setReopenTarget(null);
    } catch (err) {
      toast.error(`Failed: ${(err as Error).message}`);
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget.id);
      toast.success("Bet deleted.");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(`Failed: ${(err as Error).message}`);
    }
  };

  return (
    <>
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Placed</TableHead>
              <TableHead>Selection</TableHead>
              <TableHead className="text-right">Odds</TableHead>
              <TableHead className="text-right">Stake</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">P/L</TableHead>
              <TableHead className="text-right" title="Closing Line Value — your price vs. the last snapshot before settle. Positive means you beat the book.">CLV</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {bets.map((b) => {
              const pnl = profitMinor(b);
              const pnlTone =
                b.status === "OPEN"
                  ? "text-muted-foreground"
                  : pnl > 0
                    ? "text-[hsl(var(--success))]"
                    : pnl < 0
                      ? "text-destructive"
                      : "text-muted-foreground";
              const market = marketByKey(b.marketKey);
              const sideLabel =
                b.selection.line !== undefined
                  ? `${b.selection.side} ${b.selection.line}`
                  : b.selection.side;
              return (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {new Date(b.placedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium capitalize">{sideLabel}</div>
                    <div className="text-xs text-muted-foreground">
                      {market?.label ?? b.marketKey} · {b.book}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {b.priceDecimal.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="font-mono tabular-nums">
                      {formatMoney(b.stakeMinor, bankroll.currency)}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground tabular-nums">
                      {b.stakeUnits.toFixed(2)}u
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_TONE[b.status]}>
                      {b.status}
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-right font-mono tabular-nums ${pnlTone}`}>
                    {b.status === "OPEN" ? "—" : formatSignedMoney(pnl, bankroll.currency)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {(() => {
                      const clv = clvPct(b);
                      if (clv === null) {
                        return <span className="text-muted-foreground">—</span>;
                      }
                      const tone =
                        clv > 0
                          ? "text-[hsl(var(--success))]"
                          : clv < 0
                            ? "text-destructive"
                            : "text-muted-foreground";
                      const pct = (clv * 100).toFixed(1);
                      return (
                        <span className={tone} title={`Closing price ${b.closingPriceDecimal?.toFixed(2)}`}>
                          {clv >= 0 ? "+" : ""}{pct}%
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="size-8">
                          <MoreHorizontal className="size-4" />
                          <span className="sr-only">Bet actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        {b.status === "OPEN" ? (
                          <>
                            <DropdownMenuItem onSelect={() => setEditing(b)}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              Settle as
                            </DropdownMenuLabel>
                            <DropdownMenuItem onSelect={() => onSettle(b, "WON")}>
                              Won
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => onSettle(b, "LOST")}>
                              Lost
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => onSettle(b, "PUSH")}>
                              Push
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => onSettle(b, "VOID")}>
                              Void
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => onSettle(b, "CASHOUT")}>
                              Cash out
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <DropdownMenuItem onSelect={() => setReopenTarget(b)}>
                            Reopen…
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => setDeleteTarget(b)}
                        >
                          Delete…
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {editing && (
        <BetEntryDialog
          open={true}
          onOpenChange={(v) => !v && setEditing(null)}
          bankroll={bankroll}
          editing={editing}
        />
      )}

      <AlertDialog open={!!reopenTarget} onOpenChange={(v) => !v && setReopenTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reopen this bet?</AlertDialogTitle>
            <AlertDialogDescription>
              {reopenTarget && reopenTarget.status !== "OPEN" ? (
                <>
                  This removes the “Settled {reopenTarget.status}” entry from your ledger and puts the bet back to OPEN. Useful if you settled it by mistake.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onReopen}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reopen bet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this bet?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? (
                deleteTarget.status === "OPEN" ? (
                  <>The bet will be removed permanently. No ledger entries to clean up.</>
                ) : (
                  <>
                    The bet and its “Settled {deleteTarget.status}” ledger entry will be removed permanently. Your balance will recompute as if it never happened.
                  </>
                )
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete bet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
