import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { ReasoningEntry, ReasoningVerdict, ReasoningSource } from "@/domain/trace";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface Props {
  entries: ReasoningEntry[];
  className?: string;
  defaultOpen?: boolean;
}

const VERDICT_COLOR: Record<ReasoningVerdict, string> = {
  SUPPORT: "text-[hsl(var(--success))]",
  AGAINST: "text-destructive",
  NEUTRAL: "text-muted-foreground",
};

const SOURCE_LABEL: Record<ReasoningSource, string> = {
  adapter: "adapter",
  rule: "rule",
  leg: "leg",
  math: "math",
};

export function ReasoningTrace({ entries, className, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  if (entries.length === 0) return null;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:text-foreground"
        >
          <ChevronRight
            className={cn("size-3 transition-transform", open && "rotate-90")}
            aria-hidden
          />
          Trace ({entries.length})
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-1.5 border-l border-border pl-3">
        {entries.map((entry, idx) => (
          <div key={`${entry.id}-${idx}`} className="flex items-start gap-2 text-xs leading-relaxed">
            <span className="w-20 shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {SOURCE_LABEL[entry.source]}:{entry.id}
            </span>
            <span className="text-foreground/80">{entry.message}</span>
            <span
              className={cn(
                "ml-auto shrink-0 font-mono text-[10px] uppercase tracking-wider",
                VERDICT_COLOR[entry.verdict],
              )}
            >
              {entry.verdict.toLowerCase()}
            </span>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
