import { useState } from "react";
import { AlertTriangle, ChevronRight } from "lucide-react";
import type { ReasoningEntry, ReasoningVerdict } from "@/domain/trace";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface Props {
  entries: ReasoningEntry[];
  className?: string;
  defaultOpen?: boolean;
}

const LEG_LABELS: Record<string, string> = {
  matchup: "Matchup",
  trends: "Trends",
  lines: "Lines",
  sharpVsSquare: "Sharp / Square",
  intangibles: "Intangibles",
};

const LEG_ORDER = ["matchup", "trends", "lines", "sharpVsSquare", "intangibles"] as const;

const VERDICT_COLOR: Record<ReasoningVerdict, string> = {
  SUPPORT: "text-pos",
  AGAINST: "text-neg",
  NEUTRAL: "text-fg-muted",
};

function parseMath(entries: ReasoningEntry[]) {
  const e = entries.find((e) => e.source === "math" && e.id === "combined");
  if (!e?.data) return null;
  return {
    bonded: Boolean(e.data.bonded),
    perLegSignal: (e.data.perLegSignal ?? {}) as Record<string, number>,
  };
}

function SignalBar({ signal }: { signal: number }) {
  if (signal === 0) return null;
  const pct = Math.min(Math.abs(signal) * 100, 100);
  const color = signal > 0 ? "var(--zs-pos)" : "var(--zs-neg)";
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block h-[3px] rounded-full"
        style={{ width: `${Math.max(pct * 0.5, 4)}px`, background: color, opacity: 0.7 }}
      />
      <span className="font-mono text-[9px] tabular-nums" style={{ color }}>
        {signal > 0 ? "+" : ""}{(signal * 100).toFixed(0)}
      </span>
    </span>
  );
}

export function ReasoningTrace({ entries, className, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  if (entries.length === 0) return null;

  const math = parseMath(entries);
  const bookFilterEntry = entries.find((e) => e.source === "adapter" && e.id === "book-filter");
  const adapterEntry = entries.find((e) => e.source === "adapter" && e.id !== "book-filter");
  const mathEntry = entries.find((e) => e.source === "math");
  const ruleEntries = entries.filter((e) => e.source === "rule");

  const byLeg = new Map<string, ReasoningEntry[]>();
  for (const entry of ruleEntries) {
    const leg = String(entry.data?.leg ?? "matchup");
    const bucket = byLeg.get(leg) ?? [];
    bucket.push(entry);
    byLeg.set(leg, bucket);
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-fg-muted transition-colors hover:text-fg focus:outline-none focus-visible:text-fg"
        >
          <ChevronRight
            className={cn("size-3 transition-transform", open && "rotate-90")}
            aria-hidden
          />
          Trace ({entries.length})
          {math && (
            <span
              className="rounded px-1.5 py-0.5 text-[9px] tracking-[0.12em]"
              style={{
                background: math.bonded
                  ? "var(--zs-pos-fill)"
                  : "color-mix(in oklch, var(--zs-warn) 15%, transparent)",
                color: math.bonded ? "var(--zs-pos)" : "var(--zs-warn)",
              }}
            >
              {math.bonded ? "✓ Bonded" : "⚠ Not bonded"}
            </span>
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-3 border-l border-zs pl-3">
        {bookFilterEntry && (
          <div
            className="flex items-start gap-1.5 rounded px-2.5 py-1.5 text-[11px]"
            style={{
              background: "color-mix(in oklch, var(--zs-warn) 10%, transparent)",
              border: "1px solid color-mix(in oklch, var(--zs-warn) 25%, transparent)",
            }}
          >
            <AlertTriangle className="mt-0.5 size-3 shrink-0 text-warn" aria-hidden />
            <span className="text-fg-muted">{bookFilterEntry.message}</span>
          </div>
        )}

        {adapterEntry && (
          <div className="flex items-baseline gap-2 text-xs">
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-fg-muted">
              market
            </span>
            <span className="text-fg-dim">{adapterEntry.message}</span>
          </div>
        )}

        {LEG_ORDER.filter((leg) => byLeg.has(leg)).map((leg) => {
          const legEntries = byLeg.get(leg)!;
          const signal = math?.perLegSignal[leg] ?? 0;
          return (
            <div key={leg} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">
                  {LEG_LABELS[leg] ?? leg}
                </span>
                <SignalBar signal={signal} />
              </div>
              <div className="space-y-1 pl-2">
                {legEntries.map((entry, idx) => (
                  <div
                    key={`${entry.id}-${idx}`}
                    className="flex items-start gap-2 text-xs leading-relaxed"
                  >
                    <span
                      className={cn(
                        "shrink-0 font-mono text-[10px] uppercase tracking-wider",
                        VERDICT_COLOR[entry.verdict],
                      )}
                    >
                      {entry.verdict.toLowerCase()}
                    </span>
                    <span className="min-w-0 flex-1 text-fg-dim">{entry.message}</span>
                    {entry.data?.pattern != null && (
                      <span
                        className="ml-auto shrink-0 rounded px-1 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em]"
                        style={{ background: "var(--zs-info-fill)", color: "var(--zs-info)" }}
                      >
                        {String(entry.data.pattern).replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {mathEntry && (
          <div className="flex items-baseline gap-2 border-t border-zs pt-2 text-xs">
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-fg-muted">
              result
            </span>
            <span className="text-fg-muted">{mathEntry.message}</span>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
