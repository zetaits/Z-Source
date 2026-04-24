import { LeagueId } from "@/domain/ids";
import type { CatalogMatch, League } from "@/domain/match";
import { LEAGUES, findLeagueBySofa, type LeagueDef } from "@/config/leagues";
import { httpRequest, HttpError } from "@/services/http/httpClient";
import type { CatalogProvider } from "@/services/providers/CatalogProvider";
import {
  mapSofaStatus,
  sofaEventsResponseSchema,
  sofaSeasonsResponseSchema,
  tournamentEventsUrl,
  tournamentSeasonsUrl,
  type SofaEvent,
} from "@/services/scrape/selectors/sofaScore.v1";

const seasonCache = new Map<number, { seasonId: number; fetchedAt: number }>();
const SEASON_TTL_MS = 24 * 60 * 60 * 1000;

const fetchActiveSeason = async (tournamentId: number): Promise<number | null> => {
  const cached = seasonCache.get(tournamentId);
  if (cached && Date.now() - cached.fetchedAt < SEASON_TTL_MS) return cached.seasonId;
  try {
    const res = await httpRequest({
      url: tournamentSeasonsUrl(tournamentId),
      rps: 1,
      preferBrowserFetch: true,
      headers: { Accept: "application/json" },
    });
    const json = await res.json();
    const parsed = sofaSeasonsResponseSchema.safeParse(json);
    if (!parsed.success) return null;
    const first = parsed.data.seasons[0];
    if (!first) return null;
    seasonCache.set(tournamentId, { seasonId: first.id, fetchedAt: Date.now() });
    return first.id;
  } catch (err) {
    if (err instanceof HttpError) {
      console.warn(`[sofascore] seasons fetch failed for ${tournamentId}: ${err.status}`);
    }
    return null;
  }
};

const fetchEventsPage = async (
  tournamentId: number,
  seasonId: number,
  span: "next" | "last",
  page: number,
): Promise<{ events: SofaEvent[]; hasNext: boolean } | null> => {
  try {
    const res = await httpRequest({
      url: tournamentEventsUrl(tournamentId, seasonId, span, page),
      rps: 1,
      preferBrowserFetch: true,
      headers: { Accept: "application/json" },
      acceptStatus: [404],
    });
    if (res.status === 404) return { events: [], hasNext: false };
    const json = await res.json();
    const parsed = sofaEventsResponseSchema.safeParse(json);
    if (!parsed.success) {
      console.warn(`[sofascore] zod parse failed for ${tournamentId}/${span}/${page}`);
      return null;
    }
    return { events: parsed.data.events, hasNext: Boolean(parsed.data.hasNextPage) };
  } catch (err) {
    console.warn(`[sofascore] events fetch failed: ${(err as Error).message}`);
    return null;
  }
};

const toCatalogMatch = (event: SofaEvent, league: LeagueDef): CatalogMatch => ({
  catalogId: String(event.id),
  source: "sofascore",
  leagueId: league.id,
  leagueName: league.name,
  countryCode: league.countryCode,
  kickoffAt: new Date(event.startTimestamp * 1000).toISOString(),
  home: {
    name: event.homeTeam.name,
    aliases: aliasesFor(event.homeTeam),
    sofaScoreId: event.homeTeam.id,
  },
  away: {
    name: event.awayTeam.name,
    aliases: aliasesFor(event.awayTeam),
    sofaScoreId: event.awayTeam.id,
  },
  status: mapSofaStatus(event.status.code, event.status.type),
});

const aliasesFor = (t: { shortName?: string; nameCode?: string }): string[] => {
  const out: string[] = [];
  if (t.shortName) out.push(t.shortName);
  if (t.nameCode) out.push(t.nameCode);
  return out;
};

export const sofaScoreCatalogProvider: CatalogProvider = {
  name: "sofascore",
  async listLeagues() {
    return LEAGUES.map<League>((l) => ({
      id: l.id,
      name: l.name,
      countryCode: l.countryCode,
      tier: l.tier,
      oddsApiKey: l.oddsApiKey,
      sofaScoreId: l.sofaScoreId,
    }));
  },
  async listFixtures({ leagueIds, from, to }) {
    const enabledLeagues = LEAGUES.filter((l) => leagueIds.includes(l.id));
    const fromMs = from.getTime();
    const toMs = to.getTime();
    const results: CatalogMatch[] = [];

    for (const league of enabledLeagues) {
      const seasonId = await fetchActiveSeason(league.sofaScoreId);
      if (!seasonId) continue;

      let page = 0;
      let exhausted = false;
      while (!exhausted && page < 4) {
        const result = await fetchEventsPage(league.sofaScoreId, seasonId, "next", page);
        if (!result) break;
        let pastWindow = false;
        for (const ev of result.events) {
          const ts = ev.startTimestamp * 1000;
          if (ts < fromMs) continue;
          if (ts > toMs) {
            pastWindow = true;
            continue;
          }
          results.push(toCatalogMatch(ev, league));
        }
        if (pastWindow || !result.hasNext) exhausted = true;
        else page += 1;
      }
    }
    results.sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));
    return results;
  },
};

export const _internals_for_tests = { aliasesFor, toCatalogMatch, findLeagueBySofa, LeagueId };
