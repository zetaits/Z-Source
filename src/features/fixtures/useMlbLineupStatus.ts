import { useQuery } from "@tanstack/react-query";
import { fetchMlbLineupStatus } from "@/sports/baseball/statsapiData";

/**
 * gamePk -> "lineups posted?" for the upcoming MLB window, in one statsapi call.
 * Powers the Scanner readiness badge. `enabled` should be true only when the
 * baseball desk is active so football never triggers the fetch. Visual-only — no
 * background polling; it refreshes on the normal query staleTime / refocus.
 */
export const useMlbLineupStatus = (enabled: boolean) => {
  const query = useQuery({
    queryKey: ["mlb", "lineup-status"] as const,
    queryFn: ({ signal }) => fetchMlbLineupStatus(signal),
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
  return query.data ?? null;
};
