import { ArrowUpRight } from "lucide-react";

interface Props {
  target: {
    offset: number;
    weekday: string;
    dayLabel: string;
    count: number;
    leagueCount: number;
  } | null;
  onJump(offset: number): void;
}

export function LookAheadFooter({ target, onJump }: Props) {
  if (!target) return null;
  const relTag = target.offset === 0 ? "TODAY" : `+${target.offset}D`;
  return (
    <button
      type="button"
      onClick={() => onJump(target.offset)}
      className="group flex w-full items-center justify-between gap-3 rounded-lg border border-dashed border-zs px-4 py-3 text-left transition-colors hover:bg-zs-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex items-center gap-3">
        <ArrowUpRight className="size-4 text-info" aria-hidden />
        <span className="kicker">Look ahead</span>
        <span className="font-mono text-[13px] text-fg">
          <span className="font-semibold tabular-nums text-fg">{target.count}</span>
          {" "}fixtures on{" "}
          <span className="text-fg">{target.dayLabel}</span>
          {" "}across{" "}
          <span className="font-semibold tabular-nums text-fg">{target.leagueCount}</span>
          {" "}{target.leagueCount === 1 ? "league" : "leagues"}
        </span>
      </span>
      <span className="font-mono text-[10px] uppercase tracking-wider text-fg-muted group-hover:text-info">
        jump to {relTag} →
      </span>
    </button>
  );
}
