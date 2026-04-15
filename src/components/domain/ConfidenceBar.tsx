import { cn } from "@/lib/utils";

interface Props {
  value: number;
  className?: string;
  showLabel?: boolean;
}

export function ConfidenceBar({ value, className, showLabel = true }: Props) {
  const clamped = Math.max(0, Math.min(1, value));
  const pct = Math.round(clamped * 100);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Confidence"
      >
        <div
          className="h-full rounded-full bg-primary/80 transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{pct}%</span>
      )}
    </div>
  );
}
