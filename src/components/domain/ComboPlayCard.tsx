import type { ComboPlay } from "@/domain/play";
import { marketByKey } from "@/config/markets";
import { selectionKey } from "@/domain/market";
import { cn } from "@/lib/utils";

interface Props {
  combo: ComboPlay;
}

const SIDE_LABEL: Record<string, string> = {
  home: "Home", away: "Away", draw: "Draw",
  over: "Over", under: "Under", yes: "Yes", no: "No",
};

const formatLeg = (leg: ComboPlay["legs"][number]): string => {
  const side = SIDE_LABEL[leg.selection.side] ?? leg.selection.side;
  const base = leg.selection.line !== undefined ? `${side} ${leg.selection.line}` : side;
  return base;
};

type Tier = "prime" | "standard" | "lean";

const tierFor = (ev: number): Tier => {
  if (ev >= 0.08) return "prime";
  if (ev >= 0.04) return "standard";
  return "lean";
};

export function ComboPlayCard({ combo }: Props) {
  const ev = combo.edgePct;
  const evPct = (ev * 100).toFixed(2);
  const tier = tierFor(ev);
  const isAnchor = combo.comboType === "ANCHOR";
  const railColor = isAnchor
    ? "var(--zs-warn)"
    : tier === "prime"
      ? "var(--zs-pos)"
      : tier === "standard"
        ? "var(--zs-info)"
        : "var(--zs-warn)";
  const evColor = isAnchor ? "var(--zs-warn)" : railColor;
  const borderColor = isAnchor
    ? "color-mix(in oklch, var(--zs-warn) 35%, var(--zs-border))"
    : tier === "prime"
      ? "color-mix(in oklch, var(--zs-pos) 40%, var(--zs-border))"
      : "var(--zs-border)";
  const baseLeg = isAnchor && combo.legs[0] ? combo.legs[0] : null;

  return (
    <div
      className="grid overflow-hidden rounded-lg"
      style={{
        gridTemplateColumns: "6px 1fr auto",
        background: "var(--zs-bg-elev)",
        border: `1px solid ${borderColor}`,
      }}
    >
      {/* rail */}
      <div
        aria-hidden
        style={{ background: railColor, opacity: tier === "prime" ? 1 : 0.55 }}
      />

      {/* content */}
      <div className="flex min-w-0 flex-col gap-2.5 px-4 py-3.5">
        {/* header */}
        <div className="flex items-center gap-2">
          <span
            className="rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em]"
            style={{
              background: isAnchor ? "var(--zs-warn-fill)" : "var(--zs-info-fill)",
              color: isAnchor ? "var(--zs-warn)" : "var(--zs-info)",
            }}
          >
            {isAnchor ? "Anchor" : "Combo"}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">
            {isAnchor
              ? `boosted ${baseLeg?.priceDecimal.toFixed(2)} → ${combo.combinedDecimal.toFixed(2)}`
              : `${combo.legs.length}-leg parlay`}
          </span>
          {combo.rho !== 0 && (
            <span className="font-mono text-[10px] text-fg-muted/70">
              ρ={combo.rho > 0 ? "+" : ""}{combo.rho.toFixed(2)}
            </span>
          )}
        </div>

        {/* legs */}
        <div className="flex flex-col gap-1.5">
          {combo.legs.map((leg, i) => {
            const marketLabel = marketByKey(leg.selection.marketKey)?.label ?? leg.selection.marketKey;
            return (
              <div
                key={`${selectionKey(leg.selection)}-${i}`}
                className="flex items-baseline justify-between gap-2"
              >
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-fg-muted shrink-0">
                    {leg.selection.marketKey}
                  </span>
                  <span className="text-[14px] font-semibold tracking-tight text-fg">
                    {formatLeg(leg)}
                  </span>
                  <span className="truncate font-mono text-[10px] text-fg-muted/70">
                    {marketLabel}
                  </span>
                </div>
                <div className="shrink-0 font-mono text-[11.5px] tabular-nums text-fg-dim">
                  <span className="text-fg-muted">@</span>
                  <span className="text-fg">{leg.priceDecimal.toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* combined */}
        <div
          className="flex items-center gap-3 rounded px-2.5 py-1.5 font-mono text-[11px] tabular-nums"
          style={{ background: "var(--zs-bg)", border: "1px solid var(--zs-border)" }}
        >
          <span className="text-fg-muted">combined</span>
          <span className="font-semibold text-fg">{combo.combinedDecimal.toFixed(2)}</span>
          <span className="text-fg-muted">·</span>
          <span className="text-fg-muted">fair</span>
          <span className="text-fg">{(combo.combinedFairProb * 100).toFixed(1)}%</span>
          <span className="text-fg-muted">·</span>
          <span className="text-fg-muted">conf</span>
          <span className="text-fg">{Math.round(combo.confidence * 100)}</span>
        </div>
      </div>

      {/* edge column */}
      <div
        className={cn("flex min-w-[140px] flex-col items-end justify-center border-l border-zs px-5 py-3.5")}
        style={{ background: tier === "prime" ? "var(--zs-pos-fill)" : "transparent" }}
      >
        <div className="kicker" style={{ color: evColor, opacity: 0.8, marginBottom: 2 }}>
          Edge
        </div>
        <div className="font-display leading-none" style={{ fontSize: 28, color: evColor }}>
          +{evPct}
          <span style={{ fontSize: 16, opacity: 0.7 }}>%</span>
        </div>
        <div className="mt-1 font-mono text-[10.5px] text-fg-muted uppercase">
          {combo.verdict}
        </div>
      </div>
    </div>
  );
}
