import type { SportFixtureSource } from "@/sports/contracts";
import {
  fetchFdorgWindowFixtures,
  fetchOddsApiIoWindowFixtures,
  windowFdorgQueryKey,
  windowOddsIoQueryKey,
} from "@/services/catalog/windowFixtures";

/**
 * Football merges two feeds for progressive loading: odds-api.io (exact team
 * names, primary) and football-data.org (fdorg, for leagues without an odds
 * slug). Each is partitioned by league inside the fetchers themselves.
 */
export const footballFixtureSources = (): SportFixtureSource[] => [
  { key: windowOddsIoQueryKey, fetch: fetchOddsApiIoWindowFixtures },
  { key: windowFdorgQueryKey, fetch: fetchFdorgWindowFixtures },
];
