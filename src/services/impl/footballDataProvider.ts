import { z } from "zod";
import type { CatalogMatch, League } from "@/domain/match";
import type { H2H, TeamFormGame } from "@/domain/history";
import type { LeagueId, MatchId, TeamId } from "@/domain/ids";
import { LEAGUES } from "@/config/leagues";
import { httpRequest } from "@/services/http/httpClient";
import type { CatalogProvider } from "@/services/providers/CatalogProvider";

const FDORG_BASE = "https://api.football-data.org/v4";
const FDORG_RPS = 10 / 60;

const fdorgTeamSchema = z.object({
  id: z.number().nullable(),
  name: z.string().nullable(),
  shortName: z.string().nullish(),
  tla: z.string().nullish(),
});

const fdorgMatchSchema = z.object({
  id: z.number(),
  competition: z.object({ code: z.string().nullish(), name: z.string().nullish() }),
  utcDate: z.string().nullable(),
  status: z.string().nullish(),
  homeTeam: fdorgTeamSchema,
  awayTeam: fdorgTeamSchema,
}).passthrough();

// Per-item safe parse: one bad match won't drop the whole response
const fdorgMatchesResponseSchema = z.object({
  matches: z
    .array(z.unknown())
    .transform((items) =>
      items.flatMap((item) => {
        const r = fdorgMatchSchema.safeParse(item);
        if (!r.success) {
          console.warn("[fdorg] skipping invalid match item:", r.error.issues[0]?.message, item);
          return [];
        }
        return [r.data];
      }),
    ),
});

const fdorgH2HMatchSchema = z.object({
  id: z.number(),
  utcDate: z.string(),
  status: z.string(),
  homeTeam: z.object({ id: z.number(), name: z.string() }),
  awayTeam: z.object({ id: z.number(), name: z.string() }),
  score: z
    .object({
      fullTime: z
        .object({
          home: z.number().nullable().optional(),
          away: z.number().nullable().optional(),
        })
        .optional(),
    })
    .optional(),
});

const fdorgH2HResponseSchema = z.object({
  matches: z.array(fdorgH2HMatchSchema),
});

const mapFdorgStatus = (status: string): CatalogMatch["status"] => {
  switch (status) {
    case "IN_PLAY":
    case "PAUSED":
      return "LIVE";
    case "FINISHED":
    case "AWARDED":
      return "FT";
    case "POSTPONED":
    case "SUSPENDED":
      return "POSTPONED";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "SCHEDULED";
  }
};

const toDateStr = (d: Date) => d.toISOString().slice(0, 10);

const fdorgFetch = async <T>(
  url: string,
  apiKey: string,
  schema: z.ZodType<T>,
): Promise<T | null> => {
  try {
    const res = await httpRequest({
      url,
      rps: FDORG_RPS,
      headers: { "X-Auth-Token": apiKey, Accept: "application/json" },
    });
    const json = await res.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      console.warn(
        `[fdorg] parse error · url=${url} · ${parsed.error.issues[0]?.message ?? "unknown"}`,
      );
      return null;
    }
    return parsed.data;
  } catch (err) {
    console.warn(`[fdorg] fetch error · url=${url} · ${(err as Error).message}`);
    return null;
  }
};

export const createFootballDataCatalogProvider = (apiKey: string): CatalogProvider => ({
  name: "football-data",

  async listLeagues(): Promise<League[]> {
    return LEAGUES.filter((l) => l.footballDataCode).map((l) => ({
      id: l.id,
      name: l.name,
      countryCode: l.countryCode,
      tier: l.tier,
      oddsApiKey: l.oddsApiKey,
      sofaScoreId: l.sofaScoreId,
    }));
  },

  async listFixtures({ leagueIds, from, to }: { leagueIds: LeagueId[]; from: Date; to: Date }) {
    const fdorgLeagues = LEAGUES.filter((l) => leagueIds.includes(l.id) && l.footballDataCode);
    if (fdorgLeagues.length === 0) return [];

    const codes = fdorgLeagues.map((l) => l.footballDataCode!).join(",");
    const url = `${FDORG_BASE}/matches?competitions=${codes}&dateFrom=${toDateStr(from)}&dateTo=${toDateStr(to)}`;
    const data = await fdorgFetch(url, apiKey, fdorgMatchesResponseSchema);
    if (!data) return [];

    const results: CatalogMatch[] = [];
    for (const m of data.matches) {
      const league = fdorgLeagues.find((l) => l.footballDataCode === m.competition.code);
      if (!league) continue;
      if (
        !m.utcDate ||
        !m.homeTeam.name || !m.awayTeam.name ||
        m.homeTeam.id === null || m.awayTeam.id === null
      ) continue;
      results.push({
        catalogId: `fdorg:${m.id}`,
        source: "football-data",
        leagueId: league.id,
        leagueName: league.name,
        countryCode: league.countryCode,
        kickoffAt: m.utcDate,
        home: {
          name: m.homeTeam.name,
          aliases: m.homeTeam.shortName ? [m.homeTeam.shortName] : undefined,
          fdorgTeamId: m.homeTeam.id,
        },
        away: {
          name: m.awayTeam.name,
          aliases: m.awayTeam.shortName ? [m.awayTeam.shortName] : undefined,
          fdorgTeamId: m.awayTeam.id,
        },
        status: mapFdorgStatus(m.status ?? "SCHEDULED"),
        fdorgMatchId: m.id,
      });
    }
    results.sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));
    return results;
  },
});

export const fetchFdorgH2H = async (
  apiKey: string,
  fdorgMatchId: number,
  homeFdorgTeamId: number,
  homeId: TeamId,
  awayId: TeamId,
  limit = 30,
): Promise<H2H | null> => {
  const url = `${FDORG_BASE}/matches/${fdorgMatchId}/head2head?limit=${limit}`;
  const data = await fdorgFetch(url, apiKey, fdorgH2HResponseSchema);
  if (!data) return null;

  const finished = data.matches.filter(
    (m) => m.status === "FINISHED" || m.status === "AWARDED",
  );

  const meetings: TeamFormGame[] = [];
  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  let totalGoals = 0;

  for (const m of finished) {
    const gh = m.score?.fullTime?.home ?? null;
    const ga = m.score?.fullTime?.away ?? null;
    if (gh === null || ga === null) continue;

    const currentHomeWasHome = m.homeTeam.id === homeFdorgTeamId;
    const goalsFor = currentHomeWasHome ? gh : ga;
    const goalsAgainst = currentHomeWasHome ? ga : gh;
    const opponent = currentHomeWasHome ? m.awayTeam : m.homeTeam;
    const result: TeamFormGame["result"] =
      goalsFor > goalsAgainst ? "W" : goalsFor < goalsAgainst ? "L" : "D";

    meetings.push({
      matchId: String(m.id) as MatchId,
      date: m.utcDate,
      opponentId: `fdorg:${opponent.id}` as TeamId,
      opponentName: opponent.name,
      isHome: currentHomeWasHome,
      goalsFor,
      goalsAgainst,
      result,
    });

    if (result === "W") homeWins++;
    else if (result === "L") awayWins++;
    else draws++;
    totalGoals += gh + ga;
  }

  return {
    homeId,
    awayId,
    meetings,
    homeWins,
    awayWins,
    draws,
    averageGoals: finished.length > 0 ? totalGoals / finished.length : 0,
  };
};
