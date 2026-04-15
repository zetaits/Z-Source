import type { PlayCandidate } from "@/domain/play";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Verdict = PlayCandidate["verdict"];

const TONES: Record<Verdict, string> = {
  STRONG:
    "border-[hsl(var(--success))]/50 bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]",
  PLAY: "border-primary/40 bg-primary/15 text-primary",
  LEAN: "border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]",
  PASS: "border-border bg-muted text-muted-foreground",
};

interface Props {
  verdict: Verdict;
  className?: string;
}

export function VerdictBadge({ verdict, className }: Props) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-mono text-[10px] font-semibold uppercase tracking-wider",
        TONES[verdict],
        className,
      )}
    >
      {verdict}
    </Badge>
  );
}
