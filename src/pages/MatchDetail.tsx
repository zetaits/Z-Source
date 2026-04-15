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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MatchHeader } from "@/features/match-detail/components/MatchHeader";
import { PicksTab } from "@/features/match-detail/components/PicksTab";
import { LinesTab } from "@/features/match-detail/components/LinesTab";
import { MatchupTab } from "@/features/match-detail/components/MatchupTab";
import { TrendsTab } from "@/features/match-detail/components/TrendsTab";
import { SplitsTab } from "@/features/match-detail/components/SplitsTab";
import { SentimentTab } from "@/features/match-detail/components/SentimentTab";
import { IntangiblesTab } from "@/features/match-detail/components/IntangiblesTab";
import { useMatch } from "@/features/match-detail/hooks/useMatch";
import { useAnalysis } from "@/features/match-detail/hooks/useAnalysis";

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
            Open it from the <Link className="text-primary hover:underline" to="/scanner">Scanner</Link> after selecting a league, or the storage cache may have expired.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const plays = analysis.data?.plays ?? [];
  const oddsEventId = plays[0]?.matchId ?? null;
  const lineMatchId = oddsEventId ? MatchId(String(oddsEventId)) : null;

  return (
    <div className="flex h-full flex-col gap-6 p-8">
      <MatchHeader
        match={match}
        onRunAnalysis={() => {
          setAnalysisEnabled(true);
          if (analysisEnabled) void analysis.refetch();
        }}
        isAnalyzing={analysis.isFetching}
        analysisLabel={analysisLabel}
        resolution={analysis.data?.resolution}
      />

      {analysis.isError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Analysis failed</AlertTitle>
          <AlertDescription>
            {(analysis.error as Error)?.message ?? "Unknown error"}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="picks" className="flex flex-1 flex-col gap-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="picks">Picks</TabsTrigger>
          <TabsTrigger value="lines">Lines</TabsTrigger>
          <TabsTrigger value="matchup">Matchup</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="splits">Splits</TabsTrigger>
          <TabsTrigger value="sentiment">Sentiment</TabsTrigger>
          <TabsTrigger value="intangibles">Intangibles</TabsTrigger>
        </TabsList>

        <TabsContent value="picks" className="mt-0">
          <PicksTab
            plays={plays}
            onLogBet={openLogBet}
            ran={Boolean(analysis.data)}
            status={analysis.data?.status ?? "idle"}
            message={analysis.data?.message}
          />
        </TabsContent>

        <TabsContent value="lines" className="mt-0">
          <LinesTab matchId={lineMatchId} />
        </TabsContent>

        <TabsContent value="matchup" className="mt-0">
          <MatchupTab
            homeName={match.home.name}
            awayName={match.away.name}
            homeForm={analysis.data?.homeForm}
            awayForm={analysis.data?.awayForm}
            h2h={analysis.data?.h2h}
          />
        </TabsContent>

        <TabsContent value="trends" className="mt-0">
          <TrendsTab
            homeName={match.home.name}
            awayName={match.away.name}
            homeForm={analysis.data?.homeForm}
            awayForm={analysis.data?.awayForm}
            h2h={analysis.data?.h2h}
          />
        </TabsContent>

        <TabsContent value="splits" className="mt-0">
          <SplitsTab
            splits={analysis.data?.splits ?? {}}
            homeName={match.home.name}
            awayName={match.away.name}
          />
        </TabsContent>

        <TabsContent value="sentiment" className="mt-0">
          <SentimentTab
            splits={analysis.data?.splits ?? {}}
            homeName={match.home.name}
            awayName={match.away.name}
          />
        </TabsContent>

        <TabsContent value="intangibles" className="mt-0">
          <IntangiblesTab
            homeName={match.home.name}
            awayName={match.away.name}
            intangibles={analysis.data?.intangibles}
          />
        </TabsContent>
      </Tabs>

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
