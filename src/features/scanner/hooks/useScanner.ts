import { useQuery } from "@tanstack/react-query";
import { LeagueId } from "@/domain/ids";
import type { CatalogMatch } from "@/domain/match";
import { sofaScoreCatalogProvider } from "@/services/impl/sofaScoreCatalogProvider";
import { settingsStore } from "@/services/settings/settingsStore";
import { isPersistentStorage } from "@/storage";
import { matchesCacheRepo } from "@/storage/repos/matchesCacheRepo";

export interface ScannerWindow {
  date: Date;
  dayOffset: number;
}

const CACHE_TTL_MS = 5 * 60_000;

const buildRange = (date: Date, dayOffset: number) => {
  const from = new Date(date);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() + dayOffset);
  const to = new Date(from);
  to.setHours(23, 59, 59, 999);
  return { from, to };
};

const fetchFixtures = async (window: ScannerWindow): Promise<CatalogMatch[]> => {
  const settings = await settingsStore.load();
  const leagueIds = settings.enabledLeagueIds.map((id) => LeagueId(id));
  if (leagueIds.length === 0) return [];
  const { from, to } = buildRange(window.date, window.dayOffset);

  if (isPersistentStorage()) {
    const cached = await matchesCacheRepo.listInRange({
      leagueIds,
      from,
      to,
      maxAgeMs: CACHE_TTL_MS,
    });
    if (cached) return cached;
  }

  const fresh = await sofaScoreCatalogProvider.listFixtures({ leagueIds, from, to });

  if (isPersistentStorage() && fresh.length > 0) {
    void matchesCacheRepo.upsert(fresh).catch(() => {
      // cache write is best-effort; swallow to keep the UI path clean
    });
  }
  return fresh;
};

const cacheKey = (w: ScannerWindow) => {
  const { from, to } = buildRange(w.date, w.dayOffset);
  return ["scanner", "fixtures", from.toISOString(), to.toISOString()] as const;
};

export const useScanner = (window: ScannerWindow) =>
  useQuery({
    queryKey: cacheKey(window),
    queryFn: () => fetchFixtures(window),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
