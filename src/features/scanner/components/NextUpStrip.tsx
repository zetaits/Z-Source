import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { findLeagueById } from "@/config/leagues";
import type { CatalogMatch } from "@/domain/match";
import { KickoffBadge } from "@/components/domain/KickoffBadge";

interface Props {
  match: CatalogMatch | null;
}

const statusPill: Record<CatalogMatch["status"], string> = {
  SCHEDULED: "pill pill-ghost",
  LIVE: "pill pill-pos",
  FT: "pill pill-ghost",
  POSTPONED: "pill pill-warn",
  CANCELLED: "pill pill-neg",
};

export function NextUpStrip({ match }: Props) {
  if (!match) return null;
  const league = findLeagueById(String(match.leagueId));
  const leagueName = league?.name ?? match.leagueName ?? String(match.leagueId);
  const country = league?.countryCode ?? match.countryCode ?? "—";

  return (
    <Link
      to={`/match/${match.catalogId}`}
      className="group flex items-center gap-4 rounded-lg border border-zs px-4 py-3 transition-colors hover:bg-zs-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ background: "var(--zs-bg-elev)" }}
    >
      <span className="kicker shrink-0">Next up</span>

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="truncate text-[14px] font-semibold text-fg">{match.home.name}</span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">vs</span>
        <span className="truncate text-[14px] font-semibold text-fg">{match.away.name}</span>
      </div>

      <span className="pill pill-ghost shrink-0">
        <span className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">{country}</span>
        <span className="text-fg-dim">{leagueName}</span>
      </span>

      <KickoffBadge kickoffAt={match.kickoffAt} className="shrink-0" />

      <span className={cn(statusPill[match.status], "shrink-0 uppercase")}>
        {match.status === "LIVE" && <span className="ind ind-pos" aria-hidden />}
        {match.status.toLowerCase()}
      </span>

      <ChevronRight
        className="size-4 shrink-0 text-fg-muted transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}
