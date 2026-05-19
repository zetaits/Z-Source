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
import { Block, FlagChip, Tag, Verdict } from "@/components/zs";
import { findLeagueById } from "@/config/leagues";
import type { CatalogMatch } from "@/domain/match";
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
import { ComboDiagnosticsCard } from "@/features/match-detail/components/ComboDiagnosticsCard";
import { ReasoningTrace } from "@/components/domain/ReasoningTrace";
import { useMatch } from "@/features/match-detail/hooks/useMatch";
import { useAnalysis } from "@/features/match-detail/hooks/useAnalysis";
import type { AnalysisResult } from "@/features/match-detail/hooks/useAnalysis";
import { formatRelativeShort } from "@/lib/time";

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

  const lastToastedRef = useRef<string | null>(null);
  useEffect(() => {
    const message = analysis.isError
      ? (analysis.error as Error | undefined)?.message ?? "Analysis failed"
      : analysis.data?.status === "error"
        ? analysis.data.message ?? "Analysis failed"
        : null;
    if (message && message !== lastToastedRef.current) {
      lastToastedRef.current = message;
      toast.error("Analysis failed", { description: message });
    }
    if (!message) lastToastedRef.current = null;
  }, [analysis.isError, analysis.error, analysis.data?.status, analysis.data?.message]);

  const [prefill, setPrefill] = useState<BetEntryPrefill | null>(null);
  const openLogBet = (play: PlayCandidate) => {
    if (!match) return;
    setPrefill(toPrefill(play, String(match.leagueId)));
  };

  const analysisLabel = useMemo(() => {
    if (analysis.isFetching) return "ANALYZING…";
    if (analysis.data) return "▸ RE-RUN ANALYSIS";
    return "▸ RUN ANALYSIS";
  }, [analysis.isFetching, analysis.data]);

  if (matchLoading) {
    return (
      <div style={{ padding: "28px 32px 48px" }}>
        <Skeleton className="h-10 w-72" />
        <Skeleton className="mt-4 h-48 w-full" />
      </div>
    );
  }

  if (!match) {
    return (
      <div style={{ padding: "28px 32px 48px" }}>
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle>Fixture not found in cache</AlertTitle>
          <AlertDescription>
            Match <span className="font-mono">{id}</span> isn't cached locally. Open it from the{" "}
            <Link className="text-amber hover:underline" to="/scanner">
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
    <div style={{ padding: "20px 32px 48px" }}>
      <MatchHeaderPit
        match={match}
        analysis={analysis.data}
        onRun={() => {
          setAnalysisEnabled(true);
          if (analysisEnabled) void analysis.refetch();
        }}
        isAnalyzing={analysis.isFetching}
        analysisLabel={analysisLabel}
      />

      {/* Alerts */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
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
              Provider <span className="font-mono">{analysis.data.splitsProvider}</span> returned no
              data — picks still valid, Splits tab will be empty.
            </AlertDescription>
          </Alert>
        )}
        {analysis.data?.status === "ok" && !analysis.data.historyAvailable && (
          <Alert>
            <AlertCircle className="size-4" />
            <AlertTitle>History unavailable</AlertTitle>
            <AlertDescription>
              Provider <span className="font-mono">{analysis.data.historyProvider}</span> returned no
              data — Matchup / Intangibles tabs will be empty.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div data-tour-id="match-tabs">
        <TabStrip active={activeTab} onChange={setActiveTab} />
      </div>

      <div style={{ position: "relative", marginTop: 18 }}>
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

function shortName(name: string): string {
  const last = name.split(/\s+/).filter(Boolean).slice(-1)[0] ?? name;
  return last.toUpperCase().slice(0, 6);
}

function MatchHeaderPit({
  match,
  analysis,
  onRun,
  isAnalyzing,
  analysisLabel,
}: {
  match: CatalogMatch;
  analysis: AnalysisResult | undefined;
  onRun: () => void;
  isAnalyzing: boolean;
  analysisLabel: string;
}) {
  const league = findLeagueById(String(match.leagueId));
  const leagueName = league?.name ?? match.leagueName ?? String(match.leagueId);
  const cc = league?.countryCode ?? match.countryCode ?? "—";
  const kickoff = new Date(match.kickoffAt);
  const t = kickoff.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const dateStr = kickoff
    .toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })
    .toUpperCase();
  const relative = formatRelativeShort(match.kickoffAt);

  const homeForm = (analysis?.homeForm?.games ?? []).slice(0, 5).map((g) => g.result);
  const awayForm = (analysis?.awayForm?.games ?? []).slice(0, 5).map((g) => g.result);
  const xgHome = analysis?.homeForm
    ? analysis.homeForm.goalsFor / Math.max(1, analysis.homeForm.games.length)
    : null;
  const xgAway = analysis?.awayForm
    ? analysis.awayForm.goalsFor / Math.max(1, analysis.awayForm.games.length)
    : null;

  const verdict = analysis?.plays?.[0]?.verdict ?? null;

  return (
    <div>
      <Link
        to="/scanner"
        style={{
          background: "transparent",
          border: "none",
          color: "var(--zs-fg-muted)",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.12em",
          cursor: "pointer",
          textDecoration: "none",
          display: "inline-block",
          marginBottom: 12,
        }}
      >
        ← SCANNER / FIXTURE BOARD
      </Link>
      <div className="zs-block" style={{ padding: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "stretch" }}>
          <div style={{ padding: "22px 26px", textAlign: "right", borderRight: "1px solid var(--zs-border)" }}>
            <div className="zs-caption" style={{ marginBottom: 8 }}>HOME</div>
            <div className="zs-bignum lg" style={{ marginBottom: 4 }}>
              {shortName(match.home.name)}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--zs-fg-dim)", marginBottom: 12 }}>
              {match.home.name}
            </div>
            <FormChips results={homeForm} align="right" />
          </div>
          <div
            style={{
              padding: "22px 32px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              background: "var(--zs-bg)",
              minWidth: 220,
            }}
          >
            <div className="zs-caption" style={{ color: "var(--zs-accent)" }}>
              {t} · IN {relative.toUpperCase()}
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 900,
                fontSize: 36,
                color: "var(--zs-fg-muted)",
                letterSpacing: "-0.04em",
              }}
            >
              vs
            </div>
            {verdict ? (
              <Verdict v={verdict} big />
            ) : (
              <button className="zs-btn primary sm" onClick={onRun} disabled={isAnalyzing}>
                {analysisLabel}
              </button>
            )}
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--zs-fg-muted)", letterSpacing: "0.08em" }}>
              <FlagChip cc={cc} /> <span style={{ marginLeft: 4 }}>{leagueName}</span>
            </div>
          </div>
          <div style={{ padding: "22px 26px", borderLeft: "1px solid var(--zs-border)" }}>
            <div className="zs-caption" style={{ marginBottom: 8 }}>AWAY</div>
            <div className="zs-bignum lg" style={{ marginBottom: 4 }}>
              {shortName(match.away.name)}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--zs-fg-dim)", marginBottom: 12 }}>
              {match.away.name}
            </div>
            <FormChips results={awayForm} align="left" />
          </div>
        </div>
        <div className="zs-block-head" style={{ borderTop: "1px solid var(--zs-border)", borderBottom: "none" }}>
          <div className="l">
            ▸ {dateStr} · {match.status}
          </div>
          <div className="r" style={{ gap: 12 }}>
            {xgHome !== null && xgAway !== null && (
              <>
                <span style={{ color: "var(--zs-fg-muted)" }}>xG MODEL</span>
                <span className="tabnum" style={{ color: "var(--zs-fg)", fontWeight: 600 }}>
                  {xgHome.toFixed(2)}
                </span>
                <span style={{ color: "var(--zs-fg-muted)" }}>:</span>
                <span className="tabnum" style={{ color: "var(--zs-fg)", fontWeight: 600 }}>
                  {xgAway.toFixed(2)}
                </span>
                <span style={{ width: 1, height: 14, background: "var(--zs-border)" }} />
              </>
            )}
            <button
              className="zs-btn sm primary"
              onClick={onRun}
              disabled={isAnalyzing}
              data-tour-id="match-analyse"
            >
              {analysisLabel}
            </button>
            {analysis?.resolution && (
              <Tag tone={analysis.resolution.oddsEventId ? "pos" : "amber"}>
                {analysis.resolution.oddsEventId ? "RESOLVED" : "UNRESOLVED"}{" "}
                {Math.round(analysis.resolution.confidence * 100)}%
              </Tag>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FormChips({ results, align }: { results: string[]; align: "left" | "right" }) {
  if (results.length === 0) {
    return (
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color: "var(--zs-fg-faint)",
          letterSpacing: "0.10em",
          textAlign: align,
        }}
      >
        FORM PENDING
      </div>
    );
  }
  return (
    <div style={{ display: "flex", justifyContent: align === "right" ? "flex-end" : "flex-start", gap: 4 }}>
      {results.map((r, i) => (
        <span
          key={i}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 18,
            height: 18,
            fontSize: 9,
            fontWeight: 700,
            fontFamily: "var(--font-mono)",
            color: r === "W" ? "var(--zs-pos)" : r === "L" ? "var(--zs-neg)" : "var(--zs-fg-muted)",
            border: "1px solid currentColor",
          }}
        >
          {r}
        </span>
      ))}
    </div>
  );
}

function TabStrip({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div
      role="tablist"
      style={{
        display: "flex",
        gap: 0,
        borderBottom: "1px solid var(--zs-border)",
        marginTop: 18,
        flexWrap: "wrap",
      }}
    >
      {TABS.map((t) => {
        const isActive = t === active;
        return (
          <button
            key={t}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t)}
            style={{
              padding: "11px 18px",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              cursor: "pointer",
              background: isActive ? "var(--zs-bg-elev)" : "transparent",
              color: isActive ? "var(--zs-accent)" : "var(--zs-fg-muted)",
              border: "none",
              borderBottom: isActive ? "2px solid var(--zs-accent)" : "2px solid transparent",
              marginBottom: -1,
              whiteSpace: "nowrap",
            }}
          >
            {isActive ? "▸ " : ""}
            {t}
          </button>
        );
      })}
    </div>
  );
}

/* Picks tab — preserves the existing three branches (pre-ran / ran-with / ran-without) but
 * wrapped in the brutalist surface. */
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

  if (isFetching && !ran) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <EngineScan active={true} />
        <PicksSkeleton rows={4} />
      </div>
    );
  }

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
    const closest = [...allCandidates].sort((a, b) => b.edgePct - a.edgePct).slice(0, 5);
    const bestEdge = closest[0]?.edgePct ?? 0;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {isFetching && <EngineScan active={true} />}
        <Block
          head="THRESHOLD NOT CLEARED"
          headRight={<Tag tone="amber">{totalEvaluated} EVALUATED</Tag>}
        >
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--zs-fg-dim)", lineHeight: 1.6 }}>
            Best edge was{" "}
            <span className="tabnum" style={{ color: "var(--zs-fg)", fontWeight: 600 }}>
              {bestEdge >= 0 ? "+" : ""}
              {(bestEdge * 100).toFixed(2)}%
            </span>{" "}
            across {totalEvaluated} selections — loosen stake policy in{" "}
            <Link to="/strategy" style={{ color: "var(--zs-accent)" }}>
              Strategy
            </Link>{" "}
            or scan the odds board below.
          </div>
        </Block>
        <OddsBoard
          lines={lines}
          openers={openers}
          synthetic={synthetic}
          candidates={allCandidates}
          picks={plays}
          homeName={homeName}
          awayName={awayName}
        />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {isFetching && <EngineScan active={true} />}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--zs-fg)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
              ▸ PICKS · {plays.length} {plays.length === 1 ? "CANDIDATE" : "CANDIDATES"}
            </span>
            <span className="zs-caption">
              {plays.length} OF {totalEvaluated} CLEARED THRESHOLD
            </span>
          </div>
          {plays.map((p, i) => (
            <div
              key={p.id}
              onClick={() => setSelected(i)}
              className="zs-block"
              style={{
                cursor: "pointer",
                borderColor: i === selected ? "var(--zs-accent)" : "var(--zs-border)",
                position: "relative",
              }}
            >
              {i === selected && (
                <div
                  style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 3, background: "var(--zs-accent)" }}
                  aria-hidden
                />
              )}
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
                    <SectionHeader title={`VALUE COMBOS · ${valueCombos.length}`} sub="CORR-ADJUSTED" />
                    {valueCombos.map((c) => (
                      <ComboPlayCard key={c.id} combo={c} />
                    ))}
                  </>
                )}
                {anchorCombos.length > 0 && (
                  <>
                    <SectionHeader title={`ANCHOR PLAYS · ${anchorCombos.length}`} sub="BOOSTED CUOTA" />
                    {anchorCombos.map((c) => (
                      <ComboPlayCard key={c.id} combo={c} />
                    ))}
                  </>
                )}
                {combos.length === 0 && diagnostics && <ComboDiagnosticsCard diagnostics={diagnostics} />}
              </>
            );
          })()}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {topPlay && (
            <Block
              head={`REASONING · ${topPlay.selection.side} ${topPlay.selection.marketKey}`}
              headRight={<Tag tone={topPlay.verdict === "PLAY" || topPlay.verdict === "STRONG" ? "pos" : "amber"}>{topPlay.verdict}</Tag>}
            >
              <ReasoningTrace entries={topPlay.trace} defaultOpen={true} />
            </Block>
          )}
        </div>
      </div>

      <div style={{ borderTop: "1px dashed var(--zs-border)", paddingTop: 16 }}>
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

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--zs-fg)", letterSpacing: "0.14em" }}>
        ▸ {title}
      </span>
      {sub && <span className="zs-caption">{sub}</span>}
    </div>
  );
}
