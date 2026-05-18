import { useState } from "react";
import type { PlayCandidate } from "@/domain/play";
import { ReasoningTrace } from "@/components/domain/ReasoningTrace";

interface Props {
  candidates: PlayCandidate[];
}

const SIDE_LABEL: Record<string, string> = {
  home: "Home",
  away: "Away",
  draw: "Draw",
  over: "Over",
  under: "Under",
  yes: "Yes",
  no: "No",
  "1X": "1X",
  "12": "12",
  X2: "X2",
};

const formatSelection = (play: PlayCandidate): string => {
  const side = SIDE_LABEL[play.selection.side] ?? play.selection.side;
  const line = play.selection.line !== undefined ? ` ${play.selection.line}` : "";
  return `${play.selection.marketKey} · ${side}${line}`;
};

const LEGS = ["matchup", "trends", "lines", "sharpVsSquare", "intangibles"] as const;

const LegDots = ({ play }: { play: PlayCandidate }) => {
  const perLeg = play.trace.find((e) => e.id === "combined")?.data
    ?.perLegSignal as Record<string, number> | undefined;
  return (
    <div className="flex gap-1">
      {LEGS.map((leg) => {
        const v = perLeg?.[leg] ?? 0;
        const tone =
          v > 0.1
            ? "bg-emerald-500"
            : v < -0.1
              ? "bg-rose-500"
              : "bg-muted-foreground/40";
        return (
          <span
            key={leg}
            className={`size-2 rounded-full ${tone}`}
            title={`${leg}: ${v.toFixed(2)}`}
          />
        );
      })}
    </div>
  );
};

const formatPct = (n: number): string =>
  `${n >= 0 ? "+" : ""}${(n * 100).toFixed(2)}%`;

const formatConf = (n: number): string => `${Math.round(n * 100)}%`;

export function NearMissesCard({ candidates }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const nearMisses = [...candidates]
    .filter((c) => c.verdict === "PASS")
    .sort((a, b) => b.edgePct * b.confidence - a.edgePct * a.confidence)
    .slice(0, 3);

  if (nearMisses.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-2.5">
        <div className="kicker">Near misses · top 3 closest to threshold</div>
      </div>
      <div className="flex flex-col">
        {nearMisses.map((play) => {
          const expanded = expandedId === play.id;
          return (
            <div key={play.id} className="border-b last:border-b-0">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">
                    {formatSelection(play)}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="font-mono tabular-nums">
                      edge{" "}
                      <span
                        className={
                          play.edgePct > 0
                            ? "text-emerald-500"
                            : "text-rose-500"
                        }
                      >
                        {formatPct(play.edgePct)}
                      </span>
                    </span>
                    <span className="font-mono tabular-nums">
                      conf {formatConf(play.confidence)}
                    </span>
                    <span className="font-mono tabular-nums">
                      @ {play.price.decimal.toFixed(2)}
                    </span>
                    <LegDots play={play} />
                    {play.price.book === "synthetic-poisson" && (
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-500">
                        synth
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setExpandedId(expanded ? null : play.id)}
                >
                  {expanded ? "Hide" : "Why?"}
                </button>
              </div>
              {expanded && (
                <div className="border-t bg-muted/20 px-4 py-3">
                  <ReasoningTrace entries={play.trace} defaultOpen={true} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
