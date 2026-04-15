import { cn } from "@/lib/utils";

interface Props {
  label: string;
  betsPct?: number;
  moneyPct?: number;
  className?: string;
}

const MAX_DELTA = 40;

export function SentimentBar({ label, betsPct, moneyPct, className }: Props) {
  const hasBoth = typeof betsPct === "number" && typeof moneyPct === "number";
  const delta = hasBoth ? moneyPct! - betsPct! : 0;
  const clamped = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, delta));
  const sharpSide = delta > 0;

  const bias =
    delta === 0
      ? "Balanced"
      : delta >= 15
        ? "Sharp backing"
        : delta >= 5
          ? "Sharp lean"
          : delta <= -15
            ? "Square backing"
            : delta <= -5
              ? "Public lean"
              : "Balanced";

  const toneClass =
    delta >= 15
      ? "bg-success/80"
      : delta <= -15
        ? "bg-destructive/80"
        : Math.abs(delta) >= 5
          ? "bg-primary/70"
          : "bg-muted-foreground/40";

  const half = (Math.abs(clamped) / MAX_DELTA) * 50;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-foreground/80">
          {hasBoth ? `${delta > 0 ? "+" : ""}${delta.toFixed(0)}Δ · ${bias}` : "—"}
        </span>
      </div>
      <div
        className="relative h-2 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuemin={-MAX_DELTA}
        aria-valuemax={MAX_DELTA}
        aria-valuenow={Math.round(clamped)}
        aria-label={`${label} sharp/square delta`}
      >
        <div className="absolute left-1/2 top-0 h-full w-px bg-border" aria-hidden />
        {hasBoth && (
          <div
            className={cn("absolute top-0 h-full transition-[width] duration-300 ease-out", toneClass)}
            style={{
              left: sharpSide ? "50%" : `${50 - half}%`,
              width: `${half}%`,
            }}
            aria-hidden
          />
        )}
      </div>
      <div className="flex justify-between font-mono text-[10px] text-muted-foreground/70">
        <span>Square</span>
        <span>Sharp</span>
      </div>
    </div>
  );
}
