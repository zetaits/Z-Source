import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, HelpCircle, Zap } from "lucide-react";
import type { CatalogMatch } from "@/domain/match";
import type { AnalysisResult, ResolutionInfo } from "@/features/match-detail/hooks/useAnalysis";
import { findLeagueById } from "@/config/leagues";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  match: CatalogMatch;
  onRunAnalysis: () => void;
  isAnalyzing: boolean;
  analysisLabel: string;
  resolution?: ResolutionInfo;
  analysis?: AnalysisResult;
}

const ODDS_PROVIDER_LABEL: Record<string, string> = {
  "odds-api-io": "odds-api.io",
  "the-odds-api": "the-odds-api.com",
};

function ResolutionBadge({ resolution }: { resolution: ResolutionInfo }) {
  const pct = Math.round(resolution.confidence * 100);
  const resolved = Boolean(resolution.oddsEventId);
  const Icon = resolved ? CheckCircle2 : HelpCircle;
  const providerLabel =
    ODDS_PROVIDER_LABEL[resolution.oddsProviderId] ?? resolution.oddsProviderId;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 font-mono text-[10px] uppercase tracking-wider",
        resolved
          ? "border-zs text-pos"
          : "border-zs text-warn",
      )}
      style={{
        background: resolved ? "var(--zs-pos-fill)" : "var(--zs-warn-fill)",
      }}
      title={
        resolved
          ? `Mapped to ${providerLabel} · confidence ${pct}%`
          : `No confident ${providerLabel} match · best ${pct}%`
      }
    >
      <Icon className="size-3" aria-hidden />
      <span>{resolved ? "resolved" : "unresolved"}</span>
      <span className="opacity-70">{pct}%</span>
      <span className="border-l border-current/30 pl-1.5 opacity-60 normal-case">
        {providerLabel}
      </span>
    </span>
  );
}

/* Derive 5 pillar scores from analysis result */
function derivePillars(a: AnalysisResult): { name: string; v: number; tone: PillarTone }[] {
  const tone = (v: number): PillarTone =>
    v >= 0.7 ? "pos" : v >= 0.4 ? "info" : v >= 0.2 ? "warn" : "neg";

  /* Matchup: home ppg vs away ppg, normalised to 0-1 */
  let matchup = 0.5;
  if (a.homeForm && a.awayForm) {
    const total = a.homeForm.ppgLast + a.awayForm.ppgLast;
    matchup = total > 0 ? a.homeForm.ppgLast / total : 0.5;
  }

  /* Trends: both sides' bttsRate averaged, or 0.5 */
  let trends = 0.5;
  if (a.homeForm && a.awayForm) {
    const avgGoalsFor =
      ((a.homeForm.goalsFor / Math.max(1, a.homeForm.games.length)) +
        (a.awayForm.goalsFor / Math.max(1, a.awayForm.games.length))) /
      2;
    /* scale: 0 goals/game → 0, 3+ → 1 */
    trends = Math.min(1, avgGoalsFor / 3);
  }

  /* Lines: number of markets with line data vs openers */
  const linesMarkets = Object.keys(a.lines).length;
  const openersMarkets = Object.keys(a.openers).length;
  const lines = linesMarkets === 0 ? 0.5 : Math.min(1, (linesMarkets + openersMarkets) / 8);

  /* Sharp vs Square: splits presence + average money-beats-bets delta */
  let sharp = a.splitsAvailable ? 0.65 : 0.2;
  if (a.splitsAvailable) {
    const allSplits = Object.values(a.splits).flatMap((s) => s?.rows ?? []);
    const deltas = allSplits
      .filter((r) => r.betsPct !== undefined && r.moneyPct !== undefined)
      .map((r) => Math.abs((r.moneyPct ?? 0) - (r.betsPct ?? 0)));
    if (deltas.length > 0) {
      const avgDelta = deltas.reduce((s, v) => s + v, 0) / deltas.length;
      sharp = Math.min(1, 0.4 + avgDelta / 50);
    }
  }

  /* Intangibles: rest advantage + injury count */
  let intangibles = 0.5;
  if (a.intangibles) {
    const { homeRestDays, awayRestDays, homeInjuries, awayInjuries } = a.intangibles;
    const restScore =
      homeRestDays !== undefined && awayRestDays !== undefined
        ? 0.5 + Math.min(0.25, (homeRestDays - awayRestDays) / 10)
        : 0.5;
    const injuryPenalty = Math.min(0.3, (homeInjuries.length * 0.05));
    intangibles = Math.max(0, restScore - injuryPenalty);
  }

  return [
    { name: "Matchup", v: matchup, tone: tone(matchup) },
    { name: "Trends", v: trends, tone: tone(trends) },
    { name: "Lines", v: lines, tone: tone(lines) },
    { name: "Sharp vs Square", v: sharp, tone: tone(sharp) },
    { name: "Intangibles", v: intangibles, tone: tone(intangibles) },
  ];
}

type PillarTone = "pos" | "info" | "warn" | "neg";

const PILLAR_COLOR: Record<PillarTone, string> = {
  pos: "var(--zs-pos)",
  info: "var(--zs-info)",
  warn: "var(--zs-warn)",
  neg: "var(--zs-neg)",
};

export function MatchHeader({
  match,
  onRunAnalysis,
  isAnalyzing,
  analysisLabel,
  resolution,
  analysis,
}: Props) {
  const league = findLeagueById(String(match.leagueId));
  const leagueName = league?.name ?? match.leagueName ?? String(match.leagueId);
  const pillars = analysis ? derivePillars(analysis) : null;

  /* Form string from last 5 games */
  const formStr = (form: AnalysisResult["homeForm"]) => {
    if (!form) return null;
    return form.games
      .slice(0, 5)
      .map((g) => g.result)
      .join("");
  };
  const homeFormStr = analysis ? formStr(analysis.homeForm) : null;
  const awayFormStr = analysis ? formStr(analysis.awayForm) : null;

  return (
    <header
      className="flex flex-col gap-0 border-b border-zs"
      style={{ background: "var(--zs-bg-elev)" }}
    >
      {/* Top nav strip */}
      <div className="flex items-center justify-between px-7 pt-4 pb-3">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="-ml-2 gap-1.5 text-fg-muted hover:text-fg"
        >
          <Link to="/scanner">
            <ArrowLeft className="size-3.5" aria-hidden />
            Scanner
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          {resolution && <ResolutionBadge resolution={resolution} />}
          <Button
            onClick={onRunAnalysis}
            disabled={isAnalyzing}
            size="sm"
            style={{
              background: "var(--zs-info-fill)",
              borderColor: "color-mix(in oklch, var(--zs-info) 40%, transparent)",
              color: "var(--zs-info)",
            }}
            variant="outline"
            className="gap-1.5"
          >
            <Zap className={cn("size-4", isAnalyzing && "animate-pulse")} aria-hidden />
            {analysisLabel}
          </Button>
        </div>
      </div>

      {/* Teams row */}
      <div className="flex items-center gap-7 px-7 pb-4">
        {/* Home */}
        <div className="flex flex-1 items-center gap-3">
          <TeamCrest letter={match.home.name.charAt(0).toUpperCase()} tone="info" />
          <div>
            <div className="font-display text-[26px] leading-none text-fg">
              {match.home.name}
            </div>
            <div className="mt-1 font-mono text-[11px] text-fg-muted">
              {homeFormStr ?? leagueName}
              {analysis?.homeForm &&
                ` · xG ${(analysis.homeForm.goalsFor / Math.max(1, analysis.homeForm.games.length)).toFixed(1)}`}
            </div>
          </div>
        </div>

        <div className="font-display text-2xl text-fg-muted">vs</div>

        {/* Away */}
        <div className="flex flex-1 items-center justify-end gap-3">
          <div className="text-right">
            <div className="font-display text-[26px] leading-none text-fg">
              {match.away.name}
            </div>
            <div className="mt-1 font-mono text-[11px] text-fg-muted">
              {awayFormStr ?? ""}
              {analysis?.awayForm &&
                ` · xG ${(analysis.awayForm.goalsFor / Math.max(1, analysis.awayForm.games.length)).toFixed(1)}`}
            </div>
          </div>
          <TeamCrest letter={match.away.name.charAt(0).toUpperCase()} tone="neg" />
        </div>
      </div>

      {/* Meta strip */}
      <div className="flex flex-wrap items-center gap-2 px-7 pb-3">
        <span className="font-mono text-[11px] uppercase tracking-wider text-fg-muted">
          {leagueName}
        </span>
        <span className="text-fg-muted">·</span>
        <span className="font-mono text-[11px] text-fg-muted">
          kickoff{" "}
          {new Date(match.kickoffAt).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <span className="font-mono text-[11px] uppercase text-fg-muted/60">
          {match.status.toLowerCase()}
        </span>
      </div>

      {/* Pillar bars — only after analysis ran */}
      {pillars && (
        <div className="grid grid-cols-5 gap-3 px-7 pb-5">
          {pillars.map(({ name, v, tone }) => (
            <PillarBar key={name} name={name} v={v} tone={tone} />
          ))}
        </div>
      )}
    </header>
  );
}

function TeamCrest({ letter, tone }: { letter: string; tone: "info" | "neg" }) {
  return (
    <div
      className="flex size-12 items-center justify-center rounded-md font-display text-2xl"
      style={{
        background: `color-mix(in oklch, var(--zs-${tone}) 20%, var(--zs-surface))`,
        border: `1px solid color-mix(in oklch, var(--zs-${tone}) 40%, var(--zs-border))`,
        color: `var(--zs-${tone})`,
      }}
    >
      {letter}
    </div>
  );
}

function PillarBar({ name, v, tone }: { name: string; v: number; tone: PillarTone }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="kicker text-[9.5px]">{name}</span>
        <span
          className="font-mono text-[10px]"
          style={{ color: PILLAR_COLOR[tone] }}
        >
          {Math.round(v * 100)}
        </span>
      </div>
      <div
        className="h-1 overflow-hidden rounded-full"
        style={{ background: "var(--zs-surface-2)" }}
        role="meter"
        aria-valuenow={Math.round(v * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${v * 100}%`, background: PILLAR_COLOR[tone] }}
        />
      </div>
    </div>
  );
}
