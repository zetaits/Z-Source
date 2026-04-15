import { cn } from "@/lib/utils";

interface Props {
  label: string;
  betsPct?: number;
  moneyPct?: number;
  className?: string;
}

const clampPct = (n: number): number => Math.max(0, Math.min(100, n));

export function SplitGauge({ label, betsPct, moneyPct, className }: Props) {
  const hasBets = typeof betsPct === "number";
  const hasMoney = typeof moneyPct === "number";
  const delta = hasBets && hasMoney ? moneyPct! - betsPct! : undefined;
  const toneClass =
    delta === undefined
      ? "text-muted-foreground"
      : delta >= 15
        ? "text-success"
        : delta <= -15
          ? "text-destructive"
          : "text-muted-foreground";

  return (
    <div className={cn("rounded-md border border-border/70 bg-card/40 px-3 py-2.5", className)}>
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className={cn("font-mono text-[10px] tabular-nums", toneClass)}>
          {delta === undefined
            ? "—"
            : `${delta > 0 ? "+" : ""}${delta.toFixed(0)}Δ`}
        </span>
      </div>

      <div className="mt-2 flex flex-col gap-1.5">
        <Row label="Tickets" pct={betsPct} tone="muted" />
        <Row label="Money" pct={moneyPct} tone="primary" />
      </div>
    </div>
  );
}

function Row({ label, pct, tone }: { label: string; pct?: number; tone: "muted" | "primary" }) {
  const has = typeof pct === "number";
  const width = has ? clampPct(pct!) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 font-mono text-[10px] text-muted-foreground/80">{label}</span>
      <div
        className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(width)}
        aria-label={label}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300 ease-out",
            tone === "primary" ? "bg-primary/80" : "bg-foreground/30",
          )}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right font-mono text-[11px] tabular-nums">
        {has ? `${pct!.toFixed(0)}%` : "—"}
      </span>
    </div>
  );
}
