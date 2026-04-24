import type { CatalogMatch } from "@/domain/match";
import { LeagueId } from "@/domain/ids";
import { sofaScoreCatalogProvider } from "@/services/impl/sofaScoreCatalogProvider";
import { settingsStore } from "@/services/settings/settingsStore";
import { isPersistentStorage } from "@/storage";
import { matchesCacheRepo } from "@/storage/repos/matchesCacheRepo";

export const WINDOW_FIXTURES_TTL_MS = 5 * 60_000;
export const WINDOW_FIXTURES_DAYS = 3;
export const windowFixturesQueryKey = [
  "commandCenter",
  "fixtures",
  "window",
  WINDOW_FIXTURES_DAYS,
] as const;

export const buildWindowRange = (days = WINDOW_FIXTURES_DAYS) => {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + days);
  to.setHours(23, 59, 59, 999);
  return { from, to };
};

export const fetchWindowFixtures = async (): Promise<CatalogMatch[]> => {
  const settings = await settingsStore.load();
  const leagueIds = settings.enabledLeagueIds.map((id) => LeagueId(id));
  if (leagueIds.length === 0) return [];
  const { from, to } = buildWindowRange();

  if (isPersistentStorage()) {
    const cached = await matchesCacheRepo.listInRange({
      leagueIds,
      from,
      to,
      maxAgeMs: WINDOW_FIXTURES_TTL_MS,
    });
    if (cached) return cached;
  }

  const fresh = await sofaScoreCatalogProvider.listFixtures({ leagueIds, from, to });
  if (isPersistentStorage() && fresh.length > 0) {
    void matchesCacheRepo.upsert(fresh).catch(() => {});
  }
  return fresh;
};
