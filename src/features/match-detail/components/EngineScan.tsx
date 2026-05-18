import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { RULE_TICKER, useScanStages, type StageState } from "../hooks/useScanStages";

interface Props {
  active: boolean;
}

const fmtElapsed = (ms: number): string => {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export function EngineScan({ active }: Props) {
  const { stages, progress, elapsedMs, finishing } = useScanStages({ active });
  const pct = Math.round(progress * 100);
  const showRulesTicker = stages.find((s) => s.key === "rules")?.status === "running";

  return (
    <section
      className="rounded-lg border border-zs"
      style={{ background: "var(--zs-bg-elev)" }}
      aria-live="polite"
      aria-busy={active}
    >
      {/* Header row */}
      <header className="flex items-center justify-between gap-4 border-b border-zs px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="ind ind-info pulse-dot" aria-hidden />
          <span className="kicker">Engine scan</span>
          <span className="font-mono text-[11px] tabular-nums text-fg-muted">
            · {fmtElapsed(elapsedMs)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-48 overflow-hidden rounded-full" style={{ background: "var(--zs-surface)" }}>
            <div
              className="h-full transition-[width] duration-300 ease-out"
              style={{ width: `${pct}%`, background: "var(--zs-info)" }}
            />
          </div>
          <span className="font-mono text-[11px] tabular-nums text-info" style={{ minWidth: 38, textAlign: "right" }}>
            {pct}%
          </span>
        </div>
      </header>

      {/* Stages */}
      <ul className="flex flex-col gap-0.5 px-4 py-3">
        {stages.map((s) => (
          <StageRow key={s.key} stage={s} ticker={s.key === "rules" && showRulesTicker} flash={finishing} />
        ))}
      </ul>
    </section>
  );
}

function StageRow({
  stage,
  ticker,
  flash,
}: {
  stage: StageState;
  ticker: boolean;
  flash: boolean;
}) {
  return (
    <li
      className={cn(
        "stage-row grid items-center gap-3 rounded-sm px-2 py-1.5",
        flash && stage.status === "done" && "flash",
      )}
      style={{ gridTemplateColumns: "20px 90px 1fr auto" }}
    >
      <StatusIcon status={stage.status} />
      <span
        className={cn(
          "font-mono text-[11px] uppercase tracking-[0.14em]",
          stage.status === "done" && "text-fg",
          stage.status === "running" && "text-info",
          stage.status === "pending" && "text-fg-muted",
        )}
      >
        {stage.label}
      </span>

      <div className="min-w-0 overflow-hidden">
        {ticker ? <RuleTicker /> : (
          <span
            className={cn(
              "text-[12px]",
              stage.status === "done" && "text-fg-dim",
              stage.status === "running" && "text-fg",
              stage.status === "pending" && "text-fg-muted",
            )}
          >
            {stage.detail}
          </span>
        )}
      </div>

      <span className={cn(
        "pill",
        stage.status === "done" && "pill-pos",
        stage.status === "running" && "pill-info",
        stage.status === "pending" && "pill-ghost",
        "uppercase",
      )}>
        {stage.status}
      </span>
    </li>
  );
}

function StatusIcon({ status }: { status: StageState["status"] }) {
  if (status === "done") {
    return (
      <span
        className="flex size-4 items-center justify-center rounded-full"
        style={{ background: "var(--zs-pos-fill)", color: "var(--zs-pos)" }}
        aria-hidden
      >
        <Check className="size-3" strokeWidth={3} />
      </span>
    );
  }
  if (status === "running") {
    return <Loader2 className="size-4 animate-spin text-info" aria-hidden />;
  }
  return (
    <span
      className="size-2 rounded-full"
      style={{ background: "var(--zs-border-bright)" }}
      aria-hidden
    />
  );
}

function RuleTicker() {
  // Duplicate the list so the -50% translate loops seamlessly.
  const doubled = [...RULE_TICKER, ...RULE_TICKER];
  return (
    <div className="ticker font-mono text-[11px] uppercase tracking-wider text-fg-dim">
      {doubled.map((name, i) => (
        <span key={`${name}-${i}`} className="inline-flex items-center gap-2">
          <span className="text-fg-muted">›</span>
          <span>{name}</span>
        </span>
      ))}
    </div>
  );
}
