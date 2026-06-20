import { useQuery } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import type { CatalogMatch } from "@/domain/match";
import { useSport } from "@/features/sport/SportContext";
import { getSportModule } from "@/sports";
import type { AnalysisResult, AnalysisStatus, ResolutionInfo } from "@/sports";
import { strategyFingerprint } from "./loadStrategy";

// Re-exported for existing consumers (MatchDetail, MatchHeader). The canonical
// definitions now live in @/sports/contracts so sport modules can implement them.
export type { AnalysisResult, AnalysisStatus, ResolutionInfo };

/**
 * Sport-agnostic analysis hook. Delegates to the active sport's module — each
 * sport owns how it fetches data and (eventually) reasons about it. The query
 * key includes the sport id so switching the Sport Rail refetches.
 */
export const useAnalysis = (
  match: CatalogMatch | null | undefined,
  opts: { enabled: boolean } = { enabled: false },
) => {
  const { activeSportId } = useSport();
  const strategyKey = match ? match.catalogId : "none";
  // Set by reanalyze() so the next queryFn run bypasses the free history caches
  // (SofaScore form/h2h). Consumed once, then reset.
  const forceRef = useRef(false);
  const query = useQuery({
    queryKey: ["analysis", activeSportId, strategyKey] as const,
    queryFn: async ({ signal }) => {
      const forceRefresh = forceRef.current;
      forceRef.current = false;
      const module = getSportModule(activeSportId);
      const result = await module.analyze({ match: match!, signal, forceRefresh });
      return { ...result, fingerprint: strategyFingerprint(result.strategy) };
    },
    enabled: Boolean(match) && opts.enabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const reanalyze = useCallback(() => {
    forceRef.current = true;
    return query.refetch();
  }, [query]);

  return Object.assign(query, { reanalyze });
};
