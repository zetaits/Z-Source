// MLB reference data feed — the first non-football data source, proving the
// modular catalog layer. Hits statsapi.mlb.com (free, no key) for the upcoming
// games window. Read-only: fixtures only. No odds/history/splits here — odds
// come from the shared odds-api.io feed once a baseball engine lands.

import { z } from "zod";
import { LeagueId } from "@/domain/ids";
import type { CatalogMatch, MatchStatus } from "@/domain/match";
import { httpRequest } from "@/services/http/httpClient";
import { buildWindowRange, localDayKey } from "@/services/catalog/windowFixtures";
import { isPersistentStorage } from "@/storage";
import { matchesCacheRepo } from "@/storage/repos/matchesCacheRepo";

const STATSAPI_BASE = "https://statsapi.mlb.com/api/v1";
const MLB_SPORT_ID = 1;
const MLB_LEAGUE_ID = "mlb";
const SOURCE = "mlb-statsapi";

const teamSchema = z.object({
  team: z.object({ id: z.number().optional(), name: z.string().optional() }).optional(),
});

const gameSchema = z
  .object({
    gamePk: z.union([z.number(), z.string()]),
    gameDate: z.string().optional(),
    status: z
      .object({
        abstractGameState: z.string().optional(),
        detailedState: z.string().optional(),
      })
      .optional(),
    teams: z.object({ home: teamSchema.optional(), away: teamSchema.optional() }).optional(),
  })
  .passthrough();

const scheduleSchema = z
  .object({
    dates: z
      .array(z.object({ date: z.string().optional(), games: z.array(gameSchema).optional() }))
      .optional(),
  })
  .passthrough();

type Game = z.infer<typeof gameSchema>;

const mapStatus = (g: Game): MatchStatus => {
  const detailed = (g.status?.detailedState ?? "").toLowerCase();
  if (detailed.includes("postpone")) return "POSTPONED";
  if (detailed.includes("cancel")) return "CANCELLED";
  switch (g.status?.abstractGameState) {
    case "Live":
      return "LIVE";
    case "Final":
      return "FT";
    default:
      return "SCHEDULED";
  }
};

const toCatalogMatch = (g: Game): CatalogMatch | null => {
  const homeName = g.teams?.home?.team?.name;
  const awayName = g.teams?.away?.team?.name;
  const kickoffAt = g.gameDate;
  if (!homeName || !awayName || !kickoffAt) return null;
  return {
    catalogId: String(g.gamePk),
    source: SOURCE,
    leagueId: LeagueId(MLB_LEAGUE_ID),
    leagueName: "MLB",
    countryCode: "US",
    kickoffAt,
    home: { name: homeName },
    away: { name: awayName },
    status: mapStatus(g),
  };
};

/** Fetch the upcoming-window MLB schedule and map it to CatalogMatch[]. */
export const fetchMlbWindowFixtures = async (
  signal?: AbortSignal,
): Promise<CatalogMatch[]> => {
  const { from, to } = buildWindowRange();
  const url =
    `${STATSAPI_BASE}/schedule` +
    `?sportId=${MLB_SPORT_ID}` +
    `&startDate=${localDayKey(from)}` +
    `&endDate=${localDayKey(to)}`;

  const res = await httpRequest({ url, rps: 1, headers: { Accept: "application/json" }, signal });
  const parsed = scheduleSchema.safeParse(await res.json());
  if (!parsed.success) {
    console.warn("[mlb-statsapi] schedule parse failed", parsed.error.issues.slice(0, 3));
    return [];
  }

  const out: CatalogMatch[] = [];
  for (const date of parsed.data.dates ?? []) {
    for (const game of date.games ?? []) {
      const m = toCatalogMatch(game);
      if (m) out.push(m);
    }
  }
  console.info(`[fixtures] mlb-statsapi: ${out.length} games`);
  out.sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));
  // Persist to the shared fixtures cache so MatchDetail (useMatch ->
  // getByCatalogId) can resolve a game opened from the Scanner. Football's
  // catalog providers do the same; the baseball feed previously skipped it,
  // so every match opened reported "not found in cache".
  if (isPersistentStorage() && out.length > 0) {
    void matchesCacheRepo.upsert(out).catch(() => {});
  }
  return out;
};

export { scheduleSchema as _mlbScheduleSchema, toCatalogMatch as _mlbToCatalogMatch };
