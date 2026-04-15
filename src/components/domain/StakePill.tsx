import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  units: number;
  className?: string;
}

export function StakePill({ units, className }: Props) {
  const isZero = units <= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-[11px] tabular-nums",
        isZero
          ? "border-border bg-muted/40 text-muted-foreground/70"
          : "border-border bg-background text-foreground",
        className,
      )}
      title="Recommended stake (units)"
    >
      <Coins className="size-3" aria-hidden />
      <span className="font-semibold">{units.toFixed(2)}</span>
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">u</span>
    </span>
  );
}
