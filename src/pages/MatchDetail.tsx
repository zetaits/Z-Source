import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { MatchId } from "@/domain/ids";
import type { MarketKey } from "@/domain/market";
import type { LineSnapshot } from "@/domain/odds";
import type { ComboPlay, PlayCandidate } from "@/domain/play";
import type { AnalysisDiagnostics } from "@/engine";
import type { SyntheticPrice } from "@/engine/synthetic";
import type { BetEntryPrefill } from "@/features/bankroll/components/BetEntryDialog";
import { BetEntryDialog } from "@/features/bankroll/components/BetEntryDialog";
import { useBankrollSettings } from "@/features/bankroll/hooks/useBankroll";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { MatchHeader } from "@/features/match-detail/components/MatchHeader";
import { EngineScan } from "@/features/match-detail/components/EngineScan";
import { PicksSkeleton } from "@/features/match-detail/components/PicksSkeleton";
import { PicksTab } from "@/features/match-detail/components/PicksTab";
import { OddsBoard } from "@/features/match-detail/components/OddsBoard";
import { LinesTab } from "@/features/match-detail/components/LinesTab";
import { MatchupTab } from "@/features/match-detail/components/MatchupTab";
import { TrendsTab } from "@/features/match-detail/components/TrendsTab";
import { SplitsTab } from "@/features/match-detail/components/SplitsTab";
import { SentimentTab } from "@/features/match-detail/components/SentimentTab";
import { IntangiblesTab } from "@/features/match-detail/components/IntangiblesTab";
import { ComboPlayCard } from "@/components/domain/ComboPlayCard";
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
  const combos = analysis.data?.combos ?? [];
  const resolvedEventId = analysis.data?.resolution?.oddsEventId ?? null;
  const lineMatchId = resolvedEventId ? MatchId(resolvedEventId) : null;

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
      <div className="relative flex-1 overflow-auto px-7 py-5">
        {analysis.isFetching && <div className="scan-line" aria-hidden />}
        {activeTab === "picks" && (
          <PicksPaneOrEmpty
            plays={plays}
            combos={combos}
            allCandidates={analysis.data?.allCandidates ?? []}
            lines={analysis.data?.lines ?? {}}
            openers={analysis.data?.openers ?? {}}
            synthetic={analysis.data?.synthetic ?? {}}
            homeName={match.home.name}
            awayName={match.away.name}
            onLogBet={openLogBet}
            ran={Boolean(analysis.data)}
            isFetching={analysis.isFetching}
            status={analysis.data?.status ?? "idle"}
            message={analysis.data?.message}
            diagnostics={analysis.data?.diagnostics}
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

/* Picks tab — three branches: pre-ran, ran-with-picks, ran-without-picks (board still visible). */
function PicksPaneOrEmpty({
  plays,
  combos,
  allCandidates,
  lines,
  openers,
  synthetic,
  homeName,
  awayName,
  onLogBet,
  ran,
  isFetching,
  status,
  message,
  diagnostics,
}: {
  plays: PlayCandidate[];
  combos: ComboPlay[];
  allCandidates: PlayCandidate[];
  lines: Partial<Record<MarketKey, LineSnapshot>>;
  openers: Partial<Record<MarketKey, LineSnapshot>>;
  synthetic: Partial<Record<MarketKey, SyntheticPrice[]>>;
  homeName: string;
  awayName: string;
  onLogBet: (play: PlayCandidate) => void;
  ran: boolean;
  isFetching: boolean;
  status: string;
  message?: string;
  diagnostics?: AnalysisDiagnostics;
}) {
  const [selected, setSelected] = useState(0);
  const topPlay = plays[selected] ?? plays[0];

  // Loading state — first run (no prior data) shows EngineScan + PicksSkeleton in place of dashed card.
  if (isFetching && !ran) {
    return (
      <div className="flex flex-col gap-5">
        <EngineScan active={true} />
        <PicksSkeleton rows={4} />
      </div>
    );
  }

  // Re-run over existing data — overlay EngineScan above the picks already on screen.
  // Pre-analysis OR an error path with no lines available — keep the simple message card.
  if (!ran || (status !== "ok" && plays.length === 0 && Object.keys(lines).length === 0)) {
    return (
      <PicksTab
        plays={plays}
        allCandidates={allCandidates}
        onLogBet={onLogBet}
        ran={ran}
        status={status}
        message={message}
        diagnostics={diagnostics}
      />
    );
  }

  const totalEvaluated = allCandidates.length;

  if (plays.length === 0) {
    // Picks ran but threshold cleared zero. Slim banner + odds board + closest-to-threshold rail.
    const closest = [...allCandidates]
      .sort((a, b) => b.edgePct - a.edgePct)
      .slice(0, 5);
    const bestEdge = closest[0]?.edgePct ?? 0;
    return (
      <div className="flex flex-col gap-5">
        {isFetching && <EngineScan active={true} />}
        <div
          className="grid items-center gap-4 rounded-lg border border-zs px-4 py-3.5"
          style={{
            gridTemplateColumns: "auto 1fr auto",
            background: "var(--zs-bg-elev)",
          }}
        >
          <div
            className="flex size-9 items-center justify-center rounded-md text-base"
            style={{ background: "var(--zs-warn-fill)", color: "var(--zs-warn)" }}
            aria-hidden
          >
            ○
          </div>
          <div>
            <div className="text-[14px] font-semibold text-fg">
              No picks cleared the threshold
            </div>
            <div className="mt-0.5 text-[12px] text-fg-muted">
              Best edge was{" "}
              <span className="font-mono">
                {bestEdge >= 0 ? "+" : ""}
                {(bestEdge * 100).toFixed(2)}%
              </span>{" "}
              across {totalEvaluated} selections — loosen stake policy in Strategy or
              read the odds board below.
            </div>
          </div>
          <Link
            to="/strategy"
            className="pill pill-ghost"
            style={{ textDecoration: "none" }}
          >
            Strategy →
          </Link>
        </div>

        <OddsBoard
          lines={lines}
          openers={openers}
          synthetic={synthetic}
          candidates={allCandidates}
          picks={plays}
          homeName={homeName}
          awayName={awayName}
        />

        {closest.length > 0 && (
          <div
            className="rounded-lg border border-zs p-4"
            style={{ background: "var(--zs-bg-elev)" }}
          >
            <div className="kicker mb-3">Closest to threshold · sorted by edge</div>
            <div className="flex flex-col gap-1.5">
              {closest.map((c, i) => (
                <ClosestRow key={c.id} candidate={c} highlight={i === 0} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {isFetching && <EngineScan active={true} />}
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* Left: plays + combos */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-fg">
              Picks · {plays.length} {plays.length === 1 ? "candidate" : "candidates"}
            </span>
            <span className="kicker">
              {plays.length} of {totalEvaluated} selections cleared threshold
            </span>
          </div>
          {plays.map((p, i) => (
            <div
              key={p.id}
              onClick={() => setSelected(i)}
              className={cn(
                "cursor-pointer rounded-lg ring-1 ring-transparent transition-all",
                i === selected && "ring-info",
              )}
              style={
                i === selected
                  ? ({ "--tw-ring-color": "var(--zs-info)" } as React.CSSProperties)
                  : {}
              }
            >
              <PicksTab plays={[p]} onLogBet={onLogBet} ran={true} status="ok" />
            </div>
          ))}

          {(() => {
            const valueCombos = combos.filter((c) => c.comboType === "VALUE");
            const anchorCombos = combos.filter((c) => c.comboType === "ANCHOR");
            return (
              <>
                {valueCombos.length > 0 && (
                  <>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[13px] font-semibold text-fg">
                        Value combos · {valueCombos.length}
                      </span>
                      <span className="kicker">corr-adjusted</span>
                    </div>
                    {valueCombos.map((c) => (
                      <ComboPlayCard key={c.id} combo={c} />
                    ))}
                  </>
                )}
                {anchorCombos.length > 0 && (
                  <>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[13px] font-semibold text-fg">
                        Anchor plays · {anchorCombos.length}
                      </span>
                      <span className="kicker">boosted cuota</span>
                    </div>
                    {anchorCombos.map((c) => (
                      <ComboPlayCard key={c.id} combo={c} />
                    ))}
                  </>
                )}
              </>
            );
          })()}
        </div>

        {/* Right: reasoning */}
        <div className="flex flex-col gap-4">
          {topPlay && (
            <div
              className="rounded-lg border border-zs p-4"
              style={{ background: "var(--zs-bg-elev)" }}
            >
              <div className="kicker mb-3">
                Reasoning · {topPlay.selection.side} {topPlay.selection.marketKey}
              </div>
              <ReasoningTrace entries={topPlay.trace} defaultOpen={true} />
            </div>
          )}
        </div>
      </div>

      {/* Persistent odds board below the 2-pane area */}
      <div className="border-t border-dashed border-zs pt-4">
        <OddsBoard
          lines={lines}
          openers={openers}
          synthetic={synthetic}
          candidates={allCandidates}
          picks={plays}
          homeName={homeName}
          awayName={awayName}
          defaultMarket="OU_GOALS"
        />
      </div>
    </div>
  );
}

function ClosestRow({
  candidate,
  highlight,
}: {
  candidate: PlayCandidate;
  highlight: boolean;
}) {
  const sideLabel = candidate.selection.line !== undefined
    ? `${candidate.selection.side} ${candidate.selection.line}`
    : candidate.selection.side;
  const fairPct = (candidate.fairProb * 100).toFixed(1);
  const marketImplied = (1 / candidate.price.decimal) * 100;
  const edge = candidate.edgePct;
  const edgePct = (edge * 100).toFixed(2);
  // Bar fill scales with absolute edge magnitude, capped at 5%.
  const fillPct = Math.min(100, (Math.abs(edge) * 100 * 100) / 5);
  const tone = edge >= 0 ? "var(--zs-pos)" : "var(--zs-neg)";
  return (
    <div
      className="grid items-center gap-3 rounded px-2 py-1.5"
      style={{
        gridTemplateColumns: "1fr 80px 110px 90px 90px",
        fontSize: 12,
        background: highlight ? "var(--zs-surface)" : "transparent",
      }}
    >
      <span className="text-fg">
        <span className="text-fg-dim capitalize">{sideLabel}</span>{" "}
        <span className="kicker ml-1">{candidate.selection.marketKey}</span>
      </span>
      <span className="font-mono tabular-nums text-fg-muted">fair {fairPct}%</span>
      <span className="font-mono tabular-nums text-fg-muted">
        market {marketImplied.toFixed(1)}%
      </span>
      <span className="font-mono tabular-nums" style={{ color: tone }}>
        edge {edge >= 0 ? "+" : ""}
        {edgePct}%
      </span>
      <div className="edge-bar">
        <span style={{ width: `${fillPct}%`, background: tone }} />
      </div>
    </div>
  );
}
