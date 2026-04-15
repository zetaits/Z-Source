import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import type { Bet } from "@/domain/bet";
import { BetId, BookId, LeagueId, MatchId } from "@/domain/ids";
import type { MarketKey } from "@/domain/market";
import type { PlayCandidate } from "@/domain/play";
import type { BankrollSettings } from "@/domain/bankroll";
import { MARKETS } from "@/config/markets";
import { sidesFor } from "../marketSides";
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
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatMoney } from "@/lib/money";
import { useLogBet, useUpdateBet } from "../hooks/useBets";

const schema = z.object({
  matchId: z.string().min(1, "Match ID is required"),
  leagueId: z.string().min(1, "League ID is required"),
  marketKey: z.string().min(1),
  side: z.string().min(1, "Pick a side"),
  line: z.string().optional(),
  priceDecimal: z.coerce.number().gt(1, "Odds must be > 1.00"),
  book: z.string().min(1, "Book is required"),
  stakeUnits: z.coerce.number().gt(0, "Stake units must be > 0"),
  notes: z.string().optional(),
});

export interface BetEntryPrefill {
  matchId?: string;
  leagueId?: string;
  marketKey?: MarketKey;
  side?: string;
  line?: number;
  priceDecimal?: number;
  book?: string;
  stakeUnits?: number;
  notes?: string;
  playSnapshot?: PlayCandidate;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefill?: BetEntryPrefill;
  bankroll: BankrollSettings;
  editing?: Bet;
}

const uid = (): string =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `bet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

const initialFromPrefill = (prefill: BetEntryPrefill | undefined, editing: Bet | undefined) => {
  const source: BetEntryPrefill = editing
    ? {
        matchId: editing.matchId,
        leagueId: editing.leagueId,
        marketKey: editing.marketKey,
        side: editing.selection.side,
        line: editing.selection.line,
        priceDecimal: editing.priceDecimal,
        book: editing.book,
        stakeUnits: editing.stakeUnits,
        notes: editing.notes,
      }
    : (prefill ?? {});
  return {
    matchId: source.matchId ?? "",
    leagueId: source.leagueId ?? "",
    marketKey: (source.marketKey ?? "ML_1X2") as MarketKey,
    side: source.side ?? "",
    line: source.line !== undefined ? String(source.line) : "",
    priceDecimal: source.priceDecimal ? String(source.priceDecimal) : "",
    book: source.book ?? "",
    stakeUnits: source.stakeUnits ? String(source.stakeUnits) : "1",
    notes: source.notes ?? "",
  };
};

export function BetEntryDialog({ open, onOpenChange, prefill, bankroll, editing }: Props) {
  const [values, setValues] = useState(() => initialFromPrefill(prefill, editing));
  const log = useLogBet();
  const update = useUpdateBet();

  useEffect(() => {
    if (open) setValues(initialFromPrefill(prefill, editing));
  }, [open, prefill, editing]);

  const sidesCfg = sidesFor(values.marketKey);
  const stakePreviewMinor = useMemo(() => {
    const u = Number(values.stakeUnits);
    return Number.isFinite(u) && u > 0 ? Math.round(u * bankroll.unitValueMinor) : 0;
  }, [values.stakeUnits, bankroll.unitValueMinor]);

  const set = <K extends keyof typeof values>(k: K, v: (typeof values)[K]) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  const onMarketChange = (next: MarketKey) => {
    setValues((prev) => ({
      ...prev,
      marketKey: next,
      side: "",
      line: sidesFor(next).hasLine ? prev.line : "",
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    const v = parsed.data;
    if (sidesCfg.hasLine && !v.line) {
      toast.error("Line is required for this market");
      return;
    }
    const stakeMinor = Math.round(v.stakeUnits * bankroll.unitValueMinor);
    const baseSelection = {
      marketKey: v.marketKey as MarketKey,
      side: v.side,
      line: v.line ? Number(v.line) : undefined,
    };

    try {
      if (editing) {
        const updated: Bet = {
          ...editing,
          matchId: MatchId(v.matchId),
          leagueId: LeagueId(v.leagueId),
          marketKey: v.marketKey as MarketKey,
          selection: baseSelection,
          priceDecimal: v.priceDecimal,
          book: BookId(v.book),
          stakeUnits: v.stakeUnits,
          stakeMinor,
          notes: v.notes?.trim() || undefined,
        };
        await update.mutateAsync(updated);
        toast.success("Bet updated");
      } else {
        const bet: Bet = {
          id: BetId(uid()),
          placedAt: new Date().toISOString(),
          matchId: MatchId(v.matchId),
          leagueId: LeagueId(v.leagueId),
          marketKey: v.marketKey as MarketKey,
          selection: baseSelection,
          priceDecimal: v.priceDecimal,
          book: BookId(v.book),
          stakeUnits: v.stakeUnits,
          stakeMinor,
          status: "OPEN",
          notes: v.notes?.trim() || undefined,
          playSnapshot: prefill?.playSnapshot,
        };
        await log.mutateAsync(bet);
        toast.success(`Bet logged · ${v.stakeUnits.toFixed(2)}u staked`);
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(`Failed: ${(err as Error).message}`);
    }
  };

  const isPending = log.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit bet" : "Log bet"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Edits to amounts/odds re-sync the open exposure. Settled bets must be reopened first."
              : "Logged bets do not move your bankroll. P/L hits the ledger when you settle."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <Section title="Match">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Match ID" htmlFor="match">
                <Input
                  id="match"
                  value={values.matchId}
                  onChange={(e) => set("matchId", e.target.value)}
                  placeholder="sofascore:12345"
                  required
                />
              </Field>
              <Field label="League ID" htmlFor="league">
                <Input
                  id="league"
                  value={values.leagueId}
                  onChange={(e) => set("leagueId", e.target.value)}
                  required
                />
              </Field>
            </div>
          </Section>

          <Section title="Selection">
            <Field label="Market">
              <Select value={values.marketKey} onValueChange={(v) => onMarketChange(v as MarketKey)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MARKETS.map((m) => (
                    <SelectItem key={m.key} value={m.key}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className={`grid gap-3 ${sidesCfg.hasLine ? "grid-cols-[1fr_120px]" : "grid-cols-1"}`}>
              <Field label="Side">
                <ToggleGroup
                  type="single"
                  value={values.side}
                  onValueChange={(v) => v && set("side", v)}
                  variant="outline"
                  className="justify-start"
                >
                  {sidesCfg.sides.map((s) => (
                    <ToggleGroupItem key={s.value} value={s.value} className="px-4">
                      {s.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>
              {sidesCfg.hasLine && (
                <Field label="Line" htmlFor="line" hint={sidesCfg.lineHint}>
                  <Input
                    id="line"
                    type="number"
                    step="0.25"
                    value={values.line}
                    onChange={(e) => set("line", e.target.value)}
                    className="font-mono tabular-nums"
                    required
                  />
                </Field>
              )}
            </div>
          </Section>

          <Section title="Pricing & sizing">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Odds" htmlFor="price" hint="Decimal · e.g. 1.85">
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="1.01"
                  value={values.priceDecimal}
                  onChange={(e) => set("priceDecimal", e.target.value)}
                  className="font-mono tabular-nums"
                  required
                />
              </Field>
              <Field label="Book" htmlFor="book" hint="Pinnacle, Bet365…">
                <Input
                  id="book"
                  value={values.book}
                  onChange={(e) => set("book", e.target.value)}
                  required
                />
              </Field>
              <Field
                label="Stake"
                htmlFor="units"
                hint={
                  stakePreviewMinor > 0
                    ? `≈ ${formatMoney(stakePreviewMinor, bankroll.currency)}`
                    : `1u = ${formatMoney(bankroll.unitValueMinor, bankroll.currency)}`
                }
              >
                <div className="relative">
                  <Input
                    id="units"
                    type="number"
                    step="0.1"
                    min="0"
                    value={values.stakeUnits}
                    onChange={(e) => set("stakeUnits", e.target.value)}
                    className="pr-10 font-mono tabular-nums"
                    required
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                    u
                  </span>
                </div>
              </Field>
            </div>
          </Section>

          <Section title="Notes">
            <Textarea
              id="notes"
              value={values.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              placeholder="Anything you want to remember about this play"
            />
          </Section>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : editing ? "Save changes" : "Log bet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {title}
      </span>
      {children}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

