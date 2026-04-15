import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { CatalogMatch } from "@/domain/match";
import { KickoffBadge } from "./KickoffBadge";

interface Props {
  match: CatalogMatch;
  className?: string;
}

const statusStyles: Record<CatalogMatch["status"], string> = {
  SCHEDULED: "text-muted-foreground",
  LIVE: "text-success",
  FT: "text-muted-foreground/60",
  POSTPONED: "text-warning",
  CANCELLED: "text-destructive",
};

export function MatchRow({ match, className }: Props) {
  return (
    <Link
      to={`/match/${match.catalogId}`}
      className={cn(
        "group flex min-h-[44px] items-center gap-4 rounded-md border border-transparent px-3 py-2 transition-colors hover:border-border hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <KickoffBadge kickoffAt={match.kickoffAt} className="shrink-0" />

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-sm">{match.home.name}</span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">vs</span>
        <span className="truncate text-sm">{match.away.name}</span>
      </div>

      <span
        className={cn(
          "shrink-0 font-mono text-[10px] uppercase tracking-wider",
          statusStyles[match.status],
        )}
      >
        {match.status.toLowerCase()}
      </span>

      <ChevronRight className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}
