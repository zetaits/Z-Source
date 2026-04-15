import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { BankrollSettings } from "@/domain/bankroll";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toMajor, toMinor } from "@/lib/money";
import { useSaveBankrollSettings } from "../hooks/useBankroll";

const CURRENCIES = ["USD", "EUR", "GBP", "MXN", "ARS", "BRL"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  current: BankrollSettings;
  onReset?: (startingMinor: number) => void;
}

export function BankrollSettingsDialog({ open, onOpenChange, current, onReset }: Props) {
  const [currency, setCurrency] = useState(current.currency);
  const [unitValue, setUnitValue] = useState(String(toMajor(current.unitValueMinor)));
  const [starting, setStarting] = useState(String(toMajor(current.startingBankrollMinor)));
  const [resetLedger, setResetLedger] = useState(false);
  const save = useSaveBankrollSettings();

  useEffect(() => {
    if (open) {
      setCurrency(current.currency);
      setUnitValue(String(toMajor(current.unitValueMinor)));
      setStarting(String(toMajor(current.startingBankrollMinor)));
      setResetLedger(false);
    }
  }, [open, current]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const unit = Number(unitValue);
    const start = Number(starting);
    if (!Number.isFinite(unit) || unit <= 0) {
      toast.error("Unit value must be > 0");
      return;
    }
    if (!Number.isFinite(start) || start < 0) {
      toast.error("Starting bankroll must be ≥ 0");
      return;
    }
    const next: BankrollSettings = {
      currency,
      unitValueMinor: toMinor(unit),
      startingBankrollMinor: toMinor(start),
    };
    try {
      await save.mutateAsync(next);
      if (resetLedger && onReset) onReset(next.startingBankrollMinor);
      toast.success("Bankroll settings saved");
      onOpenChange(false);
    } catch (err) {
      toast.error(`Failed: ${(err as Error).message}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bankroll settings</DialogTitle>
          <DialogDescription>
            Currency, unit value and starting bankroll. Resetting the ledger clears every entry.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="unit">Unit value</Label>
              <Input
                id="unit"
                type="number"
                step="0.01"
                min="0"
                value={unitValue}
                onChange={(e) => setUnitValue(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="start">Starting bankroll</Label>
              <Input
                id="start"
                type="number"
                step="0.01"
                min="0"
                value={starting}
                onChange={(e) => setStarting(e.target.value)}
                required
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={resetLedger}
              onChange={(e) => setResetLedger(e.target.checked)}
            />
            Reset ledger (clears history, seeds starting bankroll)
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
