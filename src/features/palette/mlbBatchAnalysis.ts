// Batch pre-analysis for MLB games whose lineups are already posted. Drives the
// Command Palette "Analyze MLB games with lineups" action: it warms the SAME
// React Query cache key that MatchDetail's useAnalysis reads, so opening each
// match afterwards is instant (no spinner) until the entry is GC'd. Pure
// selection (selectAnalyzableMlbGames) is unit-testable; prewarm just fans the
// existing sport-module analyze() across the slate with a small concurrency cap.

import type { QueryClient } from "@tanstack/react-query";
import type { CatalogMatch } from "@/domain/match";
import { getSportModule } from "@/sports";
import type { AnalysisResult } from "@/sports";
import { strategyFingerprint } from "@/features/match-detail/hooks/loadStrategy";

// Only the statsapi fixtures feed carries a gamePk catalogId that analyze() and
// the lineup-status map agree on.
const MLB_SOURCE = "mlb-statsapi";
// MatchDetail reads ["analysis", activeSportId, catalogId]; MLB is always the
// baseball desk, so warming that sport id is what makes the cache hit land.
export const MLB_SPORT_ID = "baseball";

// Keep in lockstep with useAnalysis (staleTime) but hold prewarmed entries far
// longer than its 5-min gcTime so the slate survives until the user clicks in.
const ANALYSIS_STALE_TIME = 30_000;
const PREWARM_GC_TIME = 30 * 60_000;
// statsapi/odds-api are rate-limited in httpClient anyway; a small cap keeps the
// fan-out from queueing dozens of fetches behind the limiter at once.
const BATCH_CONCURRENCY = 3;

type AnalysisCacheValue = AnalysisResult & { fingerprint: string };

/**
 * The MLB games from `matches` whose lineups are posted, per the window
 * lineup-status map (gamePk -> posted?). `lineupStatus` is null until the
 * status query resolves — treat that as "none ready yet".
 */
export const selectAnalyzableMlbGames = (
  matches: CatalogMatch[],
  lineupStatus: Map<string, boolean> | null,
): CatalogMatch[] => {
  if (!lineupStatus) return [];
  return matches.filter(
    (m) => m.source === MLB_SOURCE && lineupStatus.get(String(m.catalogId)) === true,
  );
};

export interface BatchSummary {
  total: number;
  analyzed: number; // status === "ok"
  withPlays: number; // at least one non-PASS play
  failed: number; // threw or non-ok status
}

const analyzeOne = async (
  queryClient: QueryClient,
  sportId: string,
  match: CatalogMatch,
): Promise<AnalysisCacheValue> =>
  queryClient.fetchQuery<AnalysisCacheValue>({
    queryKey: ["analysis", sportId, match.catalogId] as const,
    queryFn: async ({ signal }) => {
      const result = await getSportModule(sportId).analyze({ match, signal, forceRefresh: false });
      return { ...result, fingerprint: strategyFingerprint(result.strategy) };
    },
    staleTime: ANALYSIS_STALE_TIME,
    gcTime: PREWARM_GC_TIME,
  });

/**
 * Warm the analysis cache for each game, capped at BATCH_CONCURRENCY in flight.
 * Reports completion count via onProgress; never rejects on a single game's
 * failure (it just counts toward `failed`).
 */
export const prewarmMlbAnalysis = async (args: {
  queryClient: QueryClient;
  games: CatalogMatch[];
  sportId?: string;
  onProgress?: (done: number, total: number) => void;
}): Promise<BatchSummary> => {
  const { queryClient, games, sportId = MLB_SPORT_ID, onProgress } = args;
  const summary: BatchSummary = { total: games.length, analyzed: 0, withPlays: 0, failed: 0 };
  let done = 0;
  const queue = [...games];

  const worker = async () => {
    for (;;) {
      const match = queue.shift();
      if (!match) return;
      try {
        const result = await analyzeOne(queryClient, sportId, match);
        if (result.status === "ok") summary.analyzed++;
        else summary.failed++;
        if (result.plays.length > 0) summary.withPlays++;
      } catch {
        summary.failed++;
      } finally {
        done++;
        onProgress?.(done, summary.total);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(BATCH_CONCURRENCY, games.length) }, worker),
  );
  return summary;
};
