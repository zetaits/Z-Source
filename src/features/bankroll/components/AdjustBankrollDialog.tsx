import { useState } from "react";
import { toast } from "sonner";
import type { LedgerKind } from "@/domain/bankroll";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toMinor } from "@/lib/money";
import { useAppendLedger } from "../hooks/useBankroll";

type Mode = "DEPOSIT" | "WITHDRAWAL" | "ADJUSTMENT";

const TITLE: Record<Mode, string> = {
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  ADJUSTMENT: "Manual adjustment",
};

interface Props {
  mode: Mode;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function AdjustBankrollDialog({ mode, open, onOpenChange }: Props) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const append = useAppendLedger();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Enter a positive amount");
      return;
    }
    const minor = toMinor(n);
    const signed = mode === "WITHDRAWAL" ? -minor : minor;
    const kind: LedgerKind = mode;
    try {
      await append.mutateAsync({
        kind,
        amountMinor: signed,
        note: note.trim() || undefined,
      });
      toast.success(`${TITLE[mode]} recorded`);
      setAmount("");
      setNote("");
      onOpenChange(false);
    } catch (err) {
      toast.error(`Failed: ${(err as Error).message}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{TITLE[mode]}</DialogTitle>
          <DialogDescription>
            {mode === "ADJUSTMENT"
              ? "Enter a positive or negative amount to reconcile the ledger. Use the sign in the note field to clarify."
              : "Amount in your base currency. Recorded in the ledger."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="amt">Amount</Label>
            <Input
              id="amt"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={append.isPending}>
              {append.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
