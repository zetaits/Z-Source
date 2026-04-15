import { useQuery } from "@tanstack/react-query";
import type { MatchId } from "@/domain/ids";
import type { MarketKey } from "@/domain/market";
import { isPersistentStorage } from "@/storage";
import { snapshotsRepo, type SnapshotRow } from "@/storage/repos/snapshotsRepo";

export const useOddsHistory = (
  matchId: MatchId | null | undefined,
  marketKey: MarketKey | undefined,
) =>
  useQuery({
    queryKey: ["odds-history", matchId, marketKey] as const,
    queryFn: async (): Promise<SnapshotRow[]> => {
      if (!isPersistentStorage() || !matchId) return [];
      return snapshotsRepo.listForMatch(matchId, marketKey);
    },
    enabled: Boolean(matchId),
    staleTime: 30_000,
  });
