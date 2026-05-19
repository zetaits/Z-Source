import type { ReactNode } from "react";
import { formatRelativeShort } from "@/lib/time";

export interface NextMatchInfo {
  homeName: string;
  awayName: string;
  kickoffAt: string;
}

interface Props {
  kicker: string;
  count: number | null;
  countLabel: string;
  nextMatch?: NextMatchInfo | null;
  action?: ReactNode;
}

export function AuroraHero({ kicker, count, countLabel, nextMatch, action }: Props) {
  const displayCount = count === null ? "…" : count.toLocaleString();

  return (
    <section
      className="zs-aurora-hero rounded-2xl border border-zs px-7 py-6"
      style={{ background: "var(--zs-bg-elev)" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="kicker">{kicker}</div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      <h1 className="font-display mt-3 leading-[1.05] tracking-tight">
        <span className="text-[42px] text-fg">{displayCount}</span>
        <span className="ml-2 text-[18px] font-normal text-fg-dim">
          {countLabel}
        </span>
      </h1>

      {nextMatch ? (
        <p className="mt-3 flex items-center gap-2 text-[13px] text-fg-dim">
          <span className="ind ind-pos pulse-dot" aria-hidden />
          <span>
            next whistle in{" "}
            <span className="font-mono tabular-nums text-fg">
              {formatRelativeShort(nextMatch.kickoffAt)}
            </span>
            {" "}—{" "}
            <span className="text-fg">{nextMatch.homeName}</span>
            <span className="text-fg-muted mx-1">vs</span>
            <span className="text-fg">{nextMatch.awayName}</span>
          </span>
        </p>
      ) : null}
    </section>
  );
}
