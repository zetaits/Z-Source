import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CatalogMatch } from "@/domain/match";
import {
  WINDOW_FIXTURES_TTL_MS,
  fetchFdorgWindowFixtures,
  fetchOddsApiIoWindowFixtures,
  fetchSofaRemainingWindowFixtures,
  windowFdorgQueryKey,
  windowOddsIoQueryKey,
  windowSofaRemainingQueryKey,
} from "@/services/catalog/windowFixtures";

export interface FixturesWindowResult {
  data: CatalogMatch[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => Promise<void>;
}

/**
 * Single source of truth for the upcoming-fixtures window. Both Command Center
 * and Scanner consume this, so we never double-fetch and the two views stay in
 * sync. Three providers run in parallel (fdorg, odds-api.io, sofascore) with
 * separate React Query entries so progressive loading still works.
 */
export const useFixturesWindow = (): FixturesWindowResult => {
  const fdorg = useQuery({
    queryKey: windowFdorgQueryKey,
    queryFn: fetchFdorgWindowFixtures,
    staleTime: WINDOW_FIXTURES_TTL_MS,
    gcTime: 30 * 60_000,
  });
  const oddsIo = useQuery({
    queryKey: windowOddsIoQueryKey,
    queryFn: fetchOddsApiIoWindowFixtures,
    staleTime: WINDOW_FIXTURES_TTL_MS,
    gcTime: 30 * 60_000,
  });
  const sofa = useQuery({
    queryKey: windowSofaRemainingQueryKey,
    queryFn: fetchSofaRemainingWindowFixtures,
    staleTime: WINDOW_FIXTURES_TTL_MS,
    gcTime: 30 * 60_000,
  });

  const data = useMemo<CatalogMatch[]>(() => {
    const merged = [
      ...(fdorg.data ?? []),
      ...(oddsIo.data ?? []),
      ...(sofa.data ?? []),
    ];
    return merged.sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));
  }, [fdorg.data, oddsIo.data, sofa.data]);

  const refetch = async () => {
    await Promise.all([fdorg.refetch(), oddsIo.refetch(), sofa.refetch()]);
  };

  return {
    data,
    isLoading: fdorg.isLoading || oddsIo.isLoading || sofa.isLoading,
    isFetching: fdorg.isFetching || oddsIo.isFetching || sofa.isFetching,
    isError: fdorg.isError || oddsIo.isError || sofa.isError,
    error: fdorg.error ?? oddsIo.error ?? sofa.error,
    refetch,
  };
};
