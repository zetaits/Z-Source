import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { CatalogMatch } from "@/domain/match";

interface Props {
  match: CatalogMatch;
  className?: string;
}

const statusPill: Record<CatalogMatch["status"], string> = {
  SCHEDULED: "pill pill-ghost",
  LIVE: "pill pill-pos",
  FT: "pill pill-ghost",
  POSTPONED: "pill pill-warn",
  CANCELLED: "pill pill-neg",
};

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const formatRelative = (iso: string, now: number): string => {
  const ts = new Date(iso).getTime();
  const diffMin = Math.round((ts - now) / 60_000);
  if (diffMin < -60) return "";
  if (diffMin < 0) return `${-diffMin}m ago`;
  if (diffMin < 60) return `in ${diffMin}m`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `in ${diffH}h`;
  const diffD = Math.round(diffH / 24);
  return `in ${diffD}d`;
};

const formatDay = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" }).toUpperCase();

export function MatchCard({ match, className }: Props) {
  const now = Date.now();
  const relative = formatRelative(match.kickoffAt, now);

  return (
    <Link
      to={`/match/${match.catalogId}`}
      className={cn(
        "group grid items-center gap-3 rounded-md border border-transparent px-3 py-3 transition-colors hover:border-zs hover:bg-zs-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      style={{ gridTemplateColumns: "92px 1fr auto auto" }}
    >
      {/* Kickoff column */}
      <div className="flex flex-col">
        <span className="font-mono text-[15px] font-semibold tabular-nums text-fg">
          {formatTime(match.kickoffAt)}
        </span>
        {relative && (
          <span className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">
            {relative}
          </span>
        )}
      </div>

      {/* Teams + meta */}
      <div className="flex min-w-0 flex-col">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[14px] font-semibold text-fg">{match.home.name}</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">vs</span>
          <span className="truncate text-[14px] font-semibold text-fg">{match.away.name}</span>
        </div>
        <span className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-fg-muted">
          {formatDay(match.kickoffAt)}
        </span>
      </div>

      {/* Status pill */}
      <span className={cn(statusPill[match.status], "shrink-0 uppercase")}>
        {match.status === "LIVE" && <span className="ind ind-pos" aria-hidden />}
        {match.status.toLowerCase()}
      </span>

      {/* Analyze + chevron */}
      <span className="flex shrink-0 items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-fg-muted transition-colors group-hover:text-info">
          analyze
        </span>
        <ChevronRight
          className="size-4 text-fg-muted transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>
    </Link>
  );
}
