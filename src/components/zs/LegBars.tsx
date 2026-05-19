import type { PlayCandidate } from "@/domain/play";
import type { Leg } from "@/domain/strategy";

export interface LegSignal {
  matchup?: number;
  trends?: number;
  lines?: number;
  sharp?: number;
  intang?: number;
}

interface Props {
  legs: LegSignal;
  compact?: boolean;
}

/** Extract perLegSignal (-1..+1) from a PlayCandidate's combined-math trace entry. */
export function extractLegSignals(play: PlayCandidate): LegSignal {
  const combined = play.trace.find((t) => t.source === "math" && t.id === "combined");
  const raw = combined?.data?.perLegSignal as Partial<Record<Leg, number>> | undefined;
  if (!raw) return {};
  return {
    matchup: raw.matchup ?? 0,
    trends: raw.trends ?? 0,
    lines: raw.lines ?? 0,
    sharp: raw.sharpVsSquare ?? 0,
    intang: raw.intangibles ?? 0,
  };
}

export function LegBars({ legs, compact = false }: Props) {
  const cells: { k: string; v: number }[] = [
    { k: "MATCHUP", v: (legs.matchup ?? 0) * 100 },
    { k: "TRENDS",  v: (legs.trends  ?? 0) * 100 },
    { k: "LINES",   v: (legs.lines   ?? 0) * 100 },
    { k: "SHARP",   v: (legs.sharp   ?? 0) * 100 },
    { k: "INTANG",  v: (legs.intang  ?? 0) * 100 },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: compact ? 4 : 8 }}>
      {cells.map((c) => {
        const tone =
          c.v > 5 ? "var(--zs-pos)" : c.v < -5 ? "var(--zs-neg)" : "var(--zs-fg-faint)";
        const pct = Math.min(100, Math.abs(c.v));
        const display = Math.round(c.v);
        return (
          <div key={c.k} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                color: "var(--zs-fg-muted)",
                letterSpacing: "0.1em",
              }}
            >
              {c.k}
            </div>
            <div className="zs-bar tall">
              <span style={{ width: `${pct}%`, background: tone }} />
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: tone,
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {display > 0 ? "+" : ""}
              {display}
            </div>
          </div>
        );
      })}
    </div>
  );
}
