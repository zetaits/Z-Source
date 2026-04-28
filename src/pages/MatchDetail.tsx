import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { MatchId } from "@/domain/ids";
import type { PlayCandidate } from "@/domain/play";
import type { BetEntryPrefill } from "@/features/bankroll/components/BetEntryDialog";
import { BetEntryDialog } from "@/features/bankroll/components/BetEntryDialog";
import { useBankrollSettings } from "@/features/bankroll/hooks/useBankroll";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { MatchHeader } from "@/features/match-detail/components/MatchHeader";
import { PicksTab } from "@/features/match-detail/components/PicksTab";
import { LinesTab } from "@/features/match-detail/components/LinesTab";
import { MatchupTab } from "@/features/match-detail/components/MatchupTab";
import { TrendsTab } from "@/features/match-detail/components/TrendsTab";
import { SplitsTab } from "@/features/match-detail/components/SplitsTab";
import { SentimentTab } from "@/features/match-detail/components/SentimentTab";
import { IntangiblesTab } from "@/features/match-detail/components/IntangiblesTab";
import { ReasoningTrace } from "@/components/domain/ReasoningTrace";
import { useMatch } from "@/features/match-detail/hooks/useMatch";
import { useAnalysis } from "@/features/match-detail/hooks/useAnalysis";
import { cn } from "@/lib/utils";

const TABS = ["picks", "lines", "matchup", "trends", "splits", "sentiment", "intangibles"] as const;
type Tab = typeof TABS[number];

const toPrefill = (play: PlayCandidate, leagueId: string): BetEntryPrefill => ({
  matchId: String(play.matchId),
  leagueId,
  marketKey: play.selection.marketKey,
  side: play.selection.side,
  line: play.selection.line,
  priceDecimal: play.price.decimal,
  book: String(play.price.book),
  stakeUnits: play.stakeUnits,
  playSnapshot: play,
});

export function MatchDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: match, isLoading: matchLoading } = useMatch(id);
  const { data: bankroll } = useBankrollSettings();

  const [analysisEnabled, setAnalysisEnabled] = useState(false);
  const analysis = useAnalysis(match ?? null, { enabled: analysisEnabled });
  const [activeTab, setActiveTab] = useState<Tab>("picks");

  const lastToastedErrorRef = useRef<string | null>(null);
  useEffect(() => {
    const message = analysis.isError
      ? (analysis.error as Error | undefined)?.message ?? "Analysis failed"
      : analysis.data?.status === "error"
        ? analysis.data.message ?? "Analysis failed"
        : null;
    if (message && message !== lastToastedErrorRef.current) {
      lastToastedErrorRef.current = message;
      toast.error("Analysis failed", { description: message });
    }
    if (!message) lastToastedErrorRef.current = null;
  }, [analysis.isError, analysis.error, analysis.data?.status, analysis.data?.message]);

  const [prefill, setPrefill] = useState<BetEntryPrefill | null>(null);
  const openLogBet = (play: PlayCandidate) => {
    if (!match) return;
    setPrefill(toPrefill(play, String(match.leagueId)));
  };

  const analysisLabel = useMemo(() => {
    if (analysis.isFetching) return "Analyzing…";
    if (analysis.data) return "Re-run analysis";
    return "Run analysis";
  }, [analysis.isFetching, analysis.data]);

  if (matchLoading) {
    return (
      <div className="flex h-full flex-col gap-6 p-8">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="flex h-full flex-col gap-6 p-8">
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle>Fixture not found in cache</AlertTitle>
          <AlertDescription>
            Match <span className="font-mono">{id}</span> isn't cached locally.
            Open it from the{" "}
            <Link className="text-info hover:underline" to="/scanner">
              Scanner
            </Link>{" "}
            after selecting a league, or the storage cache may have expired.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const plays = analysis.data?.plays ?? [];
  const oddsEventId = plays[0]?.matchId ?? null;
  const lineMatchId = oddsEventId ? MatchId(String(oddsEventId)) : null;

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--zs-bg)" }}>
      {/* Redesigned sticky header */}
      <MatchHeader
        match={match}
        onRunAnalysis={() => {
          setAnalysisEnabled(true);
          if (analysisEnabled) void analysis.refetch();
        }}
        isAnalyzing={analysis.isFetching}
        analysisLabel={analysisLabel}
        resolution={analysis.data?.resolution}
        analysis={analysis.data ?? undefined}
      />

      {/* Alerts */}
      <div className="flex flex-col gap-2 px-7 pt-4 empty:hidden">
        {analysis.isError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Analysis failed</AlertTitle>
            <AlertDescription>
              {(analysis.error as Error)?.message ?? "Unknown error"}
            </AlertDescription>
          </Alert>
        )}
        {analysis.data?.status === "ok" && !analysis.data.splitsAvailable && (
          <Alert>
            <AlertCircle className="size-4" />
            <AlertTitle>Splits unavailable</AlertTitle>
            <AlertDescription>
              Provider <span className="font-mono">{analysis.data.splitsProvider}</span>{" "}
              returned no data — picks still valid, Splits tab will be empty.
            </AlertDescription>
          </Alert>
        )}
        {analysis.data?.status === "ok" && !analysis.data.historyAvailable && (
          <Alert>
            <AlertCircle className="size-4" />
            <AlertTitle>History unavailable</AlertTitle>
            <AlertDescription>
              Provider <span className="font-mono">{analysis.data.historyProvider}</span>{" "}
              returned no data — Matchup / Intangibles tabs will be empty.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Tab strip */}
      <div
        className="flex gap-0 border-b border-zs px-7"
        style={{ background: "var(--zs-bg)" }}
        role="tablist"
      >
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={t === activeTab}
            onClick={() => setActiveTab(t)}
            className={cn(
              "border-b-2 px-3.5 py-3 font-mono text-[12px] font-medium capitalize tracking-[0.01em] transition-colors focus:outline-none",
              t === activeTab
                ? "border-info text-fg"
                : "border-transparent text-fg-muted hover:text-fg-dim",
            )}
            style={
              t === activeTab
                ? { borderBottomColor: "var(--zs-info)" }
                : {}
            }
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab body */}
      <div className="flex-1 overflow-auto px-7 py-5">
        {activeTab === "picks" && (
          <PicksPaneOrEmpty
            plays={plays}
            onLogBet={openLogBet}
            ran={Boolean(analysis.data)}
            status={analysis.data?.status ?? "idle"}
            message={analysis.data?.message}
          />
        )}
        {activeTab === "lines" && <LinesTab matchId={lineMatchId} />}
        {activeTab === "matchup" && (
          <MatchupTab
            homeName={match.home.name}
            awayName={match.away.name}
            homeForm={analysis.data?.homeForm}
            awayForm={analysis.data?.awayForm}
            h2h={analysis.data?.h2h}
          />
        )}
        {activeTab === "trends" && (
          <TrendsTab
            homeName={match.home.name}
            awayName={match.away.name}
            homeForm={analysis.data?.homeForm}
            awayForm={analysis.data?.awayForm}
            h2h={analysis.data?.h2h}
          />
        )}
        {activeTab === "splits" && (
          <SplitsTab
            splits={analysis.data?.splits ?? {}}
            lines={analysis.data?.lines ?? {}}
            homeName={match.home.name}
            awayName={match.away.name}
          />
        )}
        {activeTab === "sentiment" && (
          <SentimentTab
            splits={analysis.data?.splits ?? {}}
            homeName={match.home.name}
            awayName={match.away.name}
          />
        )}
        {activeTab === "intangibles" && (
          <IntangiblesTab
            homeName={match.home.name}
            awayName={match.away.name}
            intangibles={analysis.data?.intangibles}
          />
        )}
      </div>

      {prefill && bankroll && (
        <BetEntryDialog
          open={true}
          onOpenChange={(v) => !v && setPrefill(null)}
          prefill={prefill}
          bankroll={bankroll}
        />
      )}
    </div>
  );
}

/* Picks tab with 2-pane layout when plays exist */
function PicksPaneOrEmpty({
  plays,
  onLogBet,
  ran,
  status,
  message,
}: {
  plays: PlayCandidate[];
  onLogBet: (play: PlayCandidate) => void;
  ran: boolean;
  status: string;
  message?: string;
}) {
  const [selected, setSelected] = useState(0);
  const topPlay = plays[selected] ?? plays[0];

  if (!ran || plays.length === 0) {
    return (
      <PicksTab
        plays={plays}
        onLogBet={onLogBet}
        ran={ran}
        status={status}
        message={message}
      />
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      {/* Left: plays */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-fg">
            Picks · {plays.length} {plays.length === 1 ? "candidate" : "candidates"}
          </span>
          <span className="kicker">sorted by edge</span>
        </div>
        {plays.map((p, i) => (
          <div
            key={p.id}
            onClick={() => setSelected(i)}
            className={cn(
              "cursor-pointer rounded-lg ring-1 ring-transparent transition-all",
              i === selected && "ring-info",
            )}
            style={i === selected ? { "--tw-ring-color": "var(--zs-info)" } as React.CSSProperties : {}}
          >
            <PicksTab
              plays={[p]}
              onLogBet={onLogBet}
              ran={true}
              status="ok"
            />
          </div>
        ))}
      </div>

      {/* Right: reasoning + line note */}
      <div className="flex flex-col gap-4">
        {topPlay && (
          <div
            className="rounded-lg border border-zs p-4"
            style={{ background: "var(--zs-bg-elev)" }}
          >
            <div className="kicker mb-3">
              Reasoning ·{" "}
              {topPlay.selection.side} {topPlay.selection.marketKey}
            </div>
            <ReasoningTrace
              entries={topPlay.trace}
              defaultOpen={true}
            />
          </div>
        )}
      </div>
    </div>
  );
}
