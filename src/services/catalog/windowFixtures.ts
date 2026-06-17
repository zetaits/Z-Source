import type { CatalogMatch } from "@/domain/match";
import { LeagueId } from "@/domain/ids";
import { findLeagueById, type LeagueDef } from "@/config/leagues";
import { createFootballDataCatalogProvider } from "@/services/impl/footballDataProvider";
import { createOddsApiIoCatalogProvider } from "@/services/impl/oddsApiIoCatalogProvider";
import { sofaScoreCatalogProvider } from "@/services/impl/sofaScoreCatalogProvider";
import { settingsStore } from "@/services/settings/settingsStore";
import { isPersistentStorage } from "@/storage";
import { matchesCacheRepo } from "@/storage/repos/matchesCacheRepo";

export const WINDOW_FIXTURES_TTL_MS = 5 * 60_000;
export const WINDOW_FIXTURES_DAYS = 3;

export const windowFdorgQueryKey = [
  "commandCenter",
  "fixtures",
  "fdorg",
  WINDOW_FIXTURES_DAYS,
] as const;

export const windowOddsIoQueryKey = [
  "commandCenter",
  "fixtures",
  "odds-api-io",
  WINDOW_FIXTURES_DAYS,
] as const;

export const windowSofaRemainingQueryKey = [
  "commandCenter",
  "fixtures",
  "sofa-remaining",
  WINDOW_FIXTURES_DAYS,
] as const;

// odds-api.io is preferred over fdorg because its team names match the odds
// payload exactly (no fuzzy resolver step needed downstream). fdorg only kicks
// in for leagues we haven't mapped a slug for. sofa is the last-resort filler.
const partitionLeagues = (
  ids: LeagueId[],
  hasFdorgKey: boolean,
  hasOddsIoKey: boolean,
): { fdorg: LeagueId[]; oddsIo: LeagueId[]; sofa: LeagueId[] } => {
  const fdorg: LeagueId[] = [];
  const oddsIo: LeagueId[] = [];
  const sofa: LeagueId[] = [];
  for (const id of ids) {
    const def: LeagueDef | undefined = findLeagueById(String(id));
    if (!def) {
      sofa.push(id);
      continue;
    }
    if (hasOddsIoKey && (def.oddsApiIoSlugs?.length ?? 0) > 0) {
      oddsIo.push(id);
      continue;
    }
    if (hasFdorgKey && def.footballDataCode) {
      fdorg.push(id);
      continue;
    }
    sofa.push(id);
  }
  return { fdorg, oddsIo, sofa };
};

// Build the window in local time so the day boundaries match what users see.
// Storing/comparing with toISOString() still works because Date is an absolute
// instant — only the "today midnight" anchor changes.
export const buildWindowRange = (days = WINDOW_FIXTURES_DAYS) => {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + days);
  to.setHours(23, 59, 59, 999);
  return { from, to };
};

// YYYY-MM-DD in the user's local timezone (sv-SE locale uses ISO ordering).
export const localDayKey = (d: Date): string => d.toLocaleDateString("sv-SE");

export const fetchFdorgWindowFixtures = async (): Promise<CatalogMatch[]> => {
  const settings = await settingsStore.load();
  if (!settings.footballDataApiKey) {
    console.info("[fixtures] fdorg: skipped (no key)");
    return [];
  }
  const allLeagueIds = settings.enabledLeagueIds.map((id) => LeagueId(id));
  if (allLeagueIds.length === 0) return [];

  const { fdorg: fdorgLeagueIds } = partitionLeagues(
    allLeagueIds,
    true,
    Boolean(settings.oddsApiIoKey),
  );
  if (fdorgLeagueIds.length === 0) {
    console.info("[fixtures] fdorg: 0 leagues assigned");
    return [];
  }

  const { from, to } = buildWindowRange();

  if (isPersistentStorage()) {
    const cached = await matchesCacheRepo.listInRange({
      leagueIds: fdorgLeagueIds,
      from,
      to,
      maxAgeMs: WINDOW_FIXTURES_TTL_MS,
    });
    if (cached !== null) {
      console.info(`[fixtures] fdorg: ${cached.length} matches (cache hit)`);
      return cached;
    }
  }

  const provider = createFootballDataCatalogProvider(settings.footballDataApiKey);
  const fresh = await provider.listFixtures({ leagueIds: fdorgLeagueIds, from, to });
  console.info(`[fixtures] fdorg: ${fresh.length} matches (fresh)`);
  if (isPersistentStorage() && fresh.length > 0) {
    void matchesCacheRepo.upsert(fresh).catch(() => {});
  }
  return fresh;
};

export const fetchOddsApiIoWindowFixtures = async (): Promise<CatalogMatch[]> => {
  const settings = await settingsStore.load();
  if (!settings.oddsApiIoKey) {
    console.info("[fixtures] odds-api.io: skipped (no key)");
    return [];
  }
  const allLeagueIds = settings.enabledLeagueIds.map((id) => LeagueId(id));
  if (allLeagueIds.length === 0) return [];

  const { oddsIo } = partitionLeagues(
    allLeagueIds,
    Boolean(settings.footballDataApiKey),
    true,
  );
  if (oddsIo.length === 0) {
    console.info("[fixtures] odds-api.io: 0 leagues assigned");
    return [];
  }

  const { from, to } = buildWindowRange();

  if (isPersistentStorage()) {
    const cached = await matchesCacheRepo.listInRange({
      leagueIds: oddsIo,
      from,
      to,
      maxAgeMs: WINDOW_FIXTURES_TTL_MS,
    });
    if (cached !== null) {
      console.info(`[fixtures] odds-api.io: ${cached.length} matches (cache hit)`);
      return cached;
    }
  }

  const provider = createOddsApiIoCatalogProvider(() => ({
    apiKey: settings.oddsApiIoKey ?? "",
    sportSlug: "football",
  }));
  const fresh = await provider.listFixtures({ leagueIds: oddsIo, from, to });
  console.info(`[fixtures] odds-api.io: ${fresh.length} matches (fresh)`);
  if (isPersistentStorage() && fresh.length > 0) {
    void matchesCacheRepo.upsert(fresh).catch(() => {});
  }
  return fresh;
};

export const fetchSofaRemainingWindowFixtures = async (): Promise<CatalogMatch[]> => {
  const settings = await settingsStore.load();
  const allLeagueIds = settings.enabledLeagueIds.map((id) => LeagueId(id));
  if (allLeagueIds.length === 0) return [];

  const { sofa: sofaLeagueIds } = partitionLeagues(
    allLeagueIds,
    Boolean(settings.footballDataApiKey),
    Boolean(settings.oddsApiIoKey),
  );
  if (sofaLeagueIds.length === 0) {
    console.info("[fixtures] sofascore: 0 leagues assigned");
    return [];
  }

  const { from, to } = buildWindowRange();

  if (isPersistentStorage()) {
    const cached = await matchesCacheRepo.listInRange({
      leagueIds: sofaLeagueIds,
      from,
      to,
      maxAgeMs: WINDOW_FIXTURES_TTL_MS,
    });
    if (cached !== null) {
      console.info(`[fixtures] sofascore: ${cached.length} matches (cache hit)`);
      return cached;
    }
  }

  const fresh = await sofaScoreCatalogProvider.listFixtures({
    leagueIds: sofaLeagueIds,
    from,
    to,
  });
  console.info(`[fixtures] sofascore: ${fresh.length} matches (fresh)`);
  if (isPersistentStorage() && fresh.length > 0) {
    void matchesCacheRepo.upsert(fresh).catch(() => {});
  }
  return fresh;
};

