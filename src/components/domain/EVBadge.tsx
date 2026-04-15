import { cn } from "@/lib/utils";

interface Props {
  edgePct: number;
  className?: string;
}

const toneFor = (pct: number): string => {
  if (pct < 0) return "border-border bg-muted/40 text-muted-foreground";
  if (pct < 0.03) return "border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]";
  if (pct < 0.06) return "border-primary/40 bg-primary/10 text-primary";
  return "border-[hsl(var(--success))]/50 bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]";
};

export function EVBadge({ edgePct, className }: Props) {
  const pct = edgePct * 100;
  const sign = pct > 0 ? "+" : "";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums",
        toneFor(edgePct),
        className,
      )}
    >
      <span className="text-[9px] uppercase tracking-wider opacity-70">EV</span>
      <span>
        {sign}
        {pct.toFixed(2)}%
      </span>
    </span>
  );
}
