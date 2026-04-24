import { PlusCircle } from "lucide-react";
import type { PlayCandidate } from "@/domain/play";
import { marketByKey } from "@/config/markets";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ReasoningTrace } from "./ReasoningTrace";
import { cn } from "@/lib/utils";

interface Props {
  play: PlayCandidate;
  onLogBet?: (play: PlayCandidate) => void;
}

const SIDE_LABEL: Record<string, string> = {
  home: "Home",
  away: "Away",
  draw: "Draw",
  over: "Over",
  under: "Under",
  yes: "Yes",
  no: "No",
};

const formatSelection = (play: PlayCandidate): string => {
  const side = SIDE_LABEL[play.selection.side] ?? play.selection.side;
  return play.selection.line !== undefined ? `${side} ${play.selection.line}` : side;
};

type Tier = "prime" | "standard" | "lean" | "pass";

const tierFor = (ev: number): Tier => {
  if (ev >= 0.03) return "prime";
  if (ev >= 0.01) return "standard";
  if (ev >= 0) return "lean";
  return "pass";
};

const TIER_COPY: Record<Tier, string> = {
  prime: "PRIME",
  standard: "STANDARD",
  lean: "LEAN",
  pass: "PASS",
};

export function PlayCard({ play, onLogBet }: Props) {
  const marketLabel = marketByKey(play.selection.marketKey)?.label ?? play.selection.marketKey;
  const ev = play.edgePct;
  const evPct = (ev * 100).toFixed(2);
  const evSign = ev >= 0 ? "+" : "";
  const tier = tierFor(ev);
  const railColor =
    tier === "prime"
      ? "var(--zs-pos)"
      : tier === "standard"
        ? "var(--zs-info)"
        : tier === "lean"
          ? "var(--zs-warn)"
          : "var(--zs-fg-muted)";
  const evColor =
    tier === "prime"
      ? "var(--zs-pos)"
      : tier === "standard"
        ? "var(--zs-info)"
        : tier === "lean"
          ? "var(--zs-warn)"
          : "var(--zs-fg-muted)";

  const borderColor =
    tier === "prime"
      ? "color-mix(in oklch, var(--zs-pos) 40%, var(--zs-border))"
      : "var(--zs-border)";

  return (
    <div
      className="grid overflow-hidden rounded-lg"
      style={{
        gridTemplateColumns: "6px 1fr auto",
        background: "var(--zs-bg-elev)",
        border: `1px solid ${borderColor}`,
      }}
    >
      {/* EV magnitude rail */}
      <div
        aria-hidden
        style={{ background: railColor, opacity: tier === "prime" ? 1 : tier === "pass" ? 0.25 : 0.55 }}
      />

      {/* Content */}
      <div className="flex min-w-0 flex-col gap-2 px-4 py-3.5">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-muted">
            {play.selection.marketKey}
          </span>
          <span className="text-[16px] font-semibold tracking-tight text-fg">
            {formatSelection(play)}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-fg-muted/80">
            {marketLabel}
          </span>
          {play.verdict === "STRONG" && (
            <span className="pill pill-sharp" style={{ height: 18, fontSize: 10 }}>
              Strong signal
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11.5px] tabular-nums text-fg-dim">
          <StatInline label="fair" value={`${(play.fairProb * 100).toFixed(1)}%`} />
          <OddsStat decimal={play.price.decimal} book={String(play.price.book)} />
          <ConfInline value={play.confidence} />
          <StatInline
            label="stake"
            value={`${play.stakeUnits.toFixed(1)}u`}
            valueClass={play.stakeUnits > 0 ? "text-fg" : "text-fg-muted"}
          />
          <div className="ml-auto">
            <ReasoningTrace entries={play.trace} />
          </div>
        </div>

        {onLogBet && play.stakeUnits > 0 && (
          <div className="mt-1 flex justify-end">
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs"
              onClick={() => onLogBet(play)}
            >
              <PlusCircle className="size-3.5" aria-hidden />
              Log this bet
            </Button>
          </div>
        )}
      </div>

      {/* Dominant EV column */}
      <div
        className={cn(
          "flex min-w-[140px] flex-col items-end justify-center border-l border-zs px-5 py-3.5",
        )}
        style={{
          background: tier === "prime" ? "var(--zs-pos-fill)" : "transparent",
        }}
      >
        <div className="kicker" style={{ color: evColor, opacity: 0.8, marginBottom: 2 }}>
          Edge
        </div>
        <div
          className="font-display leading-none"
          style={{ fontSize: 28, color: evColor }}
        >
          {evSign}
          {evPct}
          <span style={{ fontSize: 16, opacity: 0.7 }}>%</span>
        </div>
        <div className="mt-1 font-mono text-[10.5px] text-fg-muted">
          {tier === "lean"
            ? "LEAN · watch"
            : tier === "pass"
              ? "PASS"
              : `${TIER_COPY[tier]} · ${play.stakeUnits.toFixed(1)}u`}
        </div>
      </div>
    </div>
  );
}

function StatInline({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-fg-muted">{label}</span>
      <span className={cn("text-fg", valueClass)}>{value}</span>
    </span>
  );
}

function ConfInline({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(1, value));
  const pct = Math.round(clamped * 100);
  const filled = Math.round(pct / 20);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-fg-muted">conf</span>
      <span className="text-fg">{pct}</span>
      <span className="inline-flex gap-[1.5px]">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            aria-hidden
            style={{
              width: 3,
              height: 10,
              borderRadius: 1,
              background: i < filled ? "var(--zs-info)" : "var(--zs-border-bright)",
            }}
          />
        ))}
      </span>
    </span>
  );
}

function OddsStat({ decimal, book }: { decimal: number; book: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex cursor-help items-baseline gap-1 rounded px-0.5 outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring"
        >
          <span className="text-fg-muted">odds</span>
          <span className="text-fg">{decimal.toFixed(2)}</span>
          <span className="text-fg-muted">@{book}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] p-0">
        <div className="flex flex-col gap-2 p-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-mono text-[9px] uppercase tracking-wider text-fg-muted">
              Best price
            </span>
            <span className="font-mono text-xs font-semibold text-fg">{book}</span>
          </div>
          <div className="border-t border-zs" />
          <p className="text-xs leading-relaxed text-fg-muted">
            Top decimal among OddsAPI books. EV is computed against this exact
            price — if your book offers less, the real edge is lower.
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
