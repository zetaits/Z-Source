import { useQuery } from "@tanstack/react-query";
import type { CatalogMatch } from "@/domain/match";
import { isPersistentStorage } from "@/storage";
import { matchesCacheRepo } from "@/storage/repos/matchesCacheRepo";

const loadMatch = async (catalogId: string): Promise<CatalogMatch | null> => {
  if (!isPersistentStorage()) return null;
  return matchesCacheRepo.getByCatalogId(catalogId);
};

export const useMatch = (catalogId: string | undefined) =>
  useQuery({
    queryKey: ["match", catalogId] as const,
    queryFn: () => loadMatch(catalogId!),
    enabled: Boolean(catalogId),
    staleTime: 60_000,
  });
