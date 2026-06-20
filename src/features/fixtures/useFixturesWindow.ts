import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import type { CatalogMatch } from "@/domain/match";
import { useSport } from "@/features/sport/SportContext";
import { getSportModule } from "@/sports";
import { WINDOW_FIXTURES_TTL_MS } from "@/services/catalog/windowFixtures";

export interface FixturesWindowResult {
  data: CatalogMatch[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => Promise<void>;
}

/**
 * Single source of truth for the upcoming-fixtures window, scoped to the active
 * sport. The sport module declares its fixture feeds (football merges three for
 * progressive loading; baseball uses one MLB feed); each gets its own React
 * Query entry so partial results stream in. Switching sport swaps the feeds.
 */
export const useFixturesWindow = (): FixturesWindowResult => {
  const { activeSportId } = useSport();
  const sources = useMemo(
    () => getSportModule(activeSportId).fixtureSources(),
    [activeSportId],
  );

  const results = useQueries({
    queries: sources.map((src) => ({
      queryKey: src.key,
      queryFn: () => src.fetch(),
      staleTime: WINDOW_FIXTURES_TTL_MS,
      gcTime: 30 * 60_000,
    })),
  });

  const data = useMemo<CatalogMatch[]>(() => {
    const merged = results.flatMap((r) => r.data ?? []);
    return merged.sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));
  }, [results]);

  const refetch = async () => {
    await Promise.all(results.map((r) => r.refetch()));
  };

  return {
    data,
    isLoading: results.some((r) => r.isLoading),
    isFetching: results.some((r) => r.isFetching),
    isError: results.some((r) => r.isError),
    error: results.find((r) => r.error)?.error,
    refetch,
  };
};
