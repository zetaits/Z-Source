import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, HelpCircle, Zap } from "lucide-react";
import type { CatalogMatch } from "@/domain/match";
import type { ResolutionInfo } from "@/features/match-detail/hooks/useAnalysis";
import { findLeagueById } from "@/config/leagues";
import { KickoffBadge } from "@/components/domain/KickoffBadge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  match: CatalogMatch;
  onRunAnalysis: () => void;
  isAnalyzing: boolean;
  analysisLabel: string;
  resolution?: ResolutionInfo;
}

function ResolutionBadge({ resolution }: { resolution: ResolutionInfo }) {
  const pct = Math.round(resolution.confidence * 100);
  const resolved = Boolean(resolution.oddsEventId);
  const Icon = resolved ? CheckCircle2 : HelpCircle;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 font-mono text-[10px] uppercase tracking-wider",
        resolved
          ? "border-success/40 bg-success/10 text-success"
          : "border-warning/40 bg-warning/10 text-warning",
      )}
      title={
        resolved
          ? `Mapped to OddsAPI event · confidence ${pct}%`
          : `No confident OddsAPI match · best ${pct}%`
      }
    >
      <Icon className="size-3" aria-hidden />
      <span>{resolved ? "resolved" : "unresolved"}</span>
      <span className="text-foreground/70">{pct}%</span>
    </span>
  );
}

export function MatchHeader({
  match,
  onRunAnalysis,
  isAnalyzing,
  analysisLabel,
  resolution,
}: Props) {
  const league = findLeagueById(String(match.leagueId));
  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild className="-ml-2 gap-1.5 text-muted-foreground">
          <Link to="/scanner">
            <ArrowLeft className="size-3.5" aria-hidden />
            Scanner
          </Link>
        </Button>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          M5 · match detail
        </span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {match.home.name}{" "}
            <span className="font-mono text-sm text-muted-foreground">vs</span>{" "}
            {match.away.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <KickoffBadge kickoffAt={match.kickoffAt} />
            <span className="rounded-sm border border-border bg-background/40 px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {league?.name ?? match.leagueName ?? match.leagueId}
            </span>
            <span className="rounded-sm border border-border bg-background/40 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
              {match.status.toLowerCase()}
            </span>
            {resolution && <ResolutionBadge resolution={resolution} />}
          </div>
        </div>

        <Button onClick={onRunAnalysis} disabled={isAnalyzing} className="gap-1.5">
          <Zap className={`size-4 ${isAnalyzing ? "animate-pulse" : ""}`} aria-hidden />
          {analysisLabel}
        </Button>
      </div>
    </header>
  );
}
