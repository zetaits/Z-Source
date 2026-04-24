import type { MatchId, TeamId } from "@/domain/ids";
import type {
  FormResult,
  H2H,
  Intangibles,
  TeamForm,
  TeamFormGame,
} from "@/domain/history";
import { httpRequest } from "@/services/http/httpClient";
import type {
  HistoryMatchQuery,
  HistoryProvider,
  HistoryTeamQuery,
} from "@/services/providers/HistoryProvider";
import {
  formCacheKey,
  h2hCacheKey,
  historyCacheRepo,
  intangiblesCacheKey,
} from "@/storage/repos/historyCacheRepo";
import {
  isFinishedEvent,
  readScore,
  sofaTeamEventsResponseSchema,
  teamEventsLastUrl,
  teamEventsNextUrl,
  type SofaEventWithScore,
} from "@/services/scrape/selectors/sofaScore.v2";

const PROVIDER_NAME = "sofascore";
const FORM_TTL_MS = 6 * 60 * 60 * 1000;
const H2H_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const INTANGIBLES_TTL_MS = 1 * 60 * 60 * 1000;
const CONGESTION_WINDOW_DAYS = 7;

const isFreshWithin = (iso: string, ttlMs: number): boolean => {
  const age = Date.now() - Date.parse(iso);
  return Number.isFinite(age) && age >= 0 && age < ttlMs;
};

const daysBetween = (a: number, b: number): number =>
  Math.max(0, Math.floor((a - b) / (24 * 60 * 60 * 1000)));

const fetchJson = async <T>(url: string): Promise<T | null> => {
  try {
    const res = await httpRequest({
      url,
      rps: 1,
      preferBrowserFetch: true,
      headers: {
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    return (await res.json()) as T;
  } catch (err) {
    const e = err as { status?: number; message?: string };
    console.warn(
      `[sofascore fetch] failed · url=${url} status=${e.status ?? "?"} msg=${e.message ?? String(err)}`,
    );
    return null;
  }
};

const mapGameForTeam = (
  ev: SofaEventWithScore,
  teamId: number,
): TeamFormGame | null => {
  if (!isFinishedEvent(ev)) return null;
  const home = readScore(ev.homeScore);
  const away = readScore(ev.awayScore);
  if (home === null || away === null) return null;
  const isHome = ev.homeTeam.id === teamId;
  const isAway = ev.awayTeam.id === teamId;
  if (!isHome && !isAway) return null;
  const goalsFor = isHome ? home : away;
  const goalsAgainst = isHome ? away : home;
  const opponent = isHome ? ev.awayTeam : ev.homeTeam;
  const result: FormResult =
    goalsFor > goalsAgainst ? "W" : goalsFor < goalsAgainst ? "L" : "D";
  return {
    matchId: String(ev.id) as MatchId,
    date: new Date(ev.startTimestamp * 1000).toISOString(),
    opponentId: String(opponent.id) as TeamId,
    opponentName: opponent.name,
    isHome,
    goalsFor,
    goalsAgainst,
    result,
  };
};

const aggregateForm = (
  teamId: TeamId,
  lastN: number,
  games: TeamFormGame[],
): TeamForm => {
  let goalsFor = 0;
  let goalsAgainst = 0;
  let cleanSheets = 0;
  let bttsCount = 0;
  let points = 0;
  for (const g of games) {
    goalsFor += g.goalsFor;
    goalsAgainst += g.goalsAgainst;
    if (g.goalsAgainst === 0) cleanSheets += 1;
    if (g.goalsFor > 0 && g.goalsAgainst > 0) bttsCount += 1;
    points += g.result === "W" ? 3 : g.result === "D" ? 1 : 0;
  }
  const n = games.length;
  return {
    teamId,
    lastN,
    games,
    goalsFor,
    goalsAgainst,
    cleanSheets,
    bttsRate: n > 0 ? bttsCount / n : 0,
    ppgLast: n > 0 ? points / n : 0,
  };
};

const aggregateH2H = (
  homeId: TeamId,
  awayId: TeamId,
  meetings: TeamFormGame[],
): H2H => {
  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  let totalGoals = 0;
  for (const m of meetings) {
    totalGoals += m.goalsFor + m.goalsAgainst;
    if (m.result === "W") homeWins += 1;
    else if (m.result === "L") awayWins += 1;
    else draws += 1;
  }
  return {
    homeId,
    awayId,
    meetings,
    homeWins,
    awayWins,
    draws,
    averageGoals: meetings.length > 0 ? totalGoals / meetings.length : 0,
  };
};

const fetchTeamEvents = async (
  url: string,
): Promise<SofaEventWithScore[]> => {
  const raw = await fetchJson<unknown>(url);
  if (!raw) return [];
  const parsed = sofaTeamEventsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn(
      `[sofascore team events] zod parse failed · url=${url} issues=${parsed.error.issues.length}`,
    );
    return [];
  }
  return parsed.data.events;
};

const H2H_PAGES_PER_TEAM = 3;

const fetchMeetingsViaTeamEvents = async (
  homeSofaId: number,
  awaySofaId: number,
): Promise<SofaEventWithScore[]> => {
  const urls: string[] = [];
  for (let p = 0; p < H2H_PAGES_PER_TEAM; p++) {
    urls.push(teamEventsLastUrl(homeSofaId, p));
    urls.push(teamEventsLastUrl(awaySofaId, p));
  }
  const pages = await Promise.all(urls.map(fetchTeamEvents));
  const seen = new Set<number>();
  const unique: SofaEventWithScore[] = [];
  for (const ev of pages.flat()) {
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    unique.push(ev);
  }
  return unique.filter(
    (ev) =>
      (ev.homeTeam.id === homeSofaId && ev.awayTeam.id === awaySofaId) ||
      (ev.homeTeam.id === awaySofaId && ev.awayTeam.id === homeSofaId),
  );
};

export const createSofaScoreHistoryProvider = (): HistoryProvider => ({
  name: PROVIDER_NAME,

  async getForm(teamId: TeamId, lastN: number, query?: HistoryTeamQuery): Promise<TeamForm> {
    const sofaId = query?.sofaScoreTeamId;
    if (!sofaId) {
      console.warn(
        `[sofascore form] missing sofaScoreTeamId for teamId=${teamId} — returning empty form. Clear matches_cache if stale.`,
      );
      return aggregateForm(teamId, lastN, []);
    }

    const cacheKey = formCacheKey(sofaId, lastN);
    const cached = await historyCacheRepo.get<TeamForm>(cacheKey).catch(() => null);
    if (cached && isFreshWithin(cached.fetchedAt, FORM_TTL_MS)) {
      return { ...cached.payload, teamId };
    }

    const events = await fetchTeamEvents(teamEventsLastUrl(sofaId, 0));
    // SofaScore returns events ASC by startTimestamp. Sort DESC so "last N"
    // actually means the N most recent finished games.
    const sorted = [...events].sort(
      (a, b) => b.startTimestamp - a.startTimestamp,
    );
    const games = sorted
      .map((ev) => mapGameForTeam(ev, sofaId))
      .filter((g): g is TeamFormGame => g !== null)
      .slice(0, lastN);
    const form = aggregateForm(teamId, lastN, games);
    await historyCacheRepo
      .upsert({ cacheKey, payload: form, fetchedAt: new Date().toISOString() })
      .catch(() => undefined);
    return form;
  },

  async getH2H(homeId: TeamId, awayId: TeamId, query?: HistoryMatchQuery): Promise<H2H> {
    const homeSofaId = query?.homeSofaScoreId;
    const awaySofaId = query?.awaySofaScoreId;
    if (!homeSofaId || !awaySofaId) {
      console.warn(
        `[sofascore h2h] missing ids · homeSofaId=${homeSofaId} awaySofaId=${awaySofaId} — returning empty. Clear matches_cache if stale.`,
      );
      return aggregateH2H(homeId, awayId, []);
    }

    const cacheKey = h2hCacheKey(homeSofaId, awaySofaId);
    const cached = await historyCacheRepo.get<H2H>(cacheKey).catch(() => null);
    if (cached && isFreshWithin(cached.fetchedAt, H2H_TTL_MS)) {
      return { ...cached.payload, homeId, awayId };
    }

    const encounters = await fetchMeetingsViaTeamEvents(homeSofaId, awaySofaId);
    const meetings = encounters
      .map((ev) => mapGameForTeam(ev, homeSofaId))
      .filter((g): g is TeamFormGame => g !== null)
      .sort((a, b) => b.date.localeCompare(a.date));
    if (meetings.length === 0) {
      console.warn(
        `[sofascore h2h] no finished meetings in team histories · homeSofaId=${homeSofaId} awaySofaId=${awaySofaId} scanned=${encounters.length}`,
      );
    }
    const h2h = aggregateH2H(homeId, awayId, meetings);
    await historyCacheRepo
      .upsert({ cacheKey, payload: h2h, fetchedAt: new Date().toISOString() })
      .catch(() => undefined);
    return h2h;
  },

  async getIntangibles(
    matchId: MatchId,
    query?: HistoryMatchQuery,
  ): Promise<Intangibles> {
    const homeSofaId = query?.homeSofaScoreId;
    const awaySofaId = query?.awaySofaScoreId;
    if (!homeSofaId || !awaySofaId) {
      return {
        matchId,
        homeInjuries: [],
        awayInjuries: [],
      };
    }

    const cacheKey = intangiblesCacheKey(String(matchId));
    const cached = await historyCacheRepo.get<Intangibles>(cacheKey).catch(() => null);
    if (cached && isFreshWithin(cached.fetchedAt, INTANGIBLES_TTL_MS)) {
      return { ...cached.payload, matchId };
    }

    const [homeLast, awayLast, homeNext, awayNext] = await Promise.all([
      fetchTeamEvents(teamEventsLastUrl(homeSofaId, 0)),
      fetchTeamEvents(teamEventsLastUrl(awaySofaId, 0)),
      fetchTeamEvents(teamEventsNextUrl(homeSofaId, 0)),
      fetchTeamEvents(teamEventsNextUrl(awaySofaId, 0)),
    ]);

    const now = Date.now();
    const lastFinishedTs = (evs: SofaEventWithScore[]): number | null => {
      const finished = evs.filter(isFinishedEvent);
      if (finished.length === 0) return null;
      return finished[0].startTimestamp * 1000;
    };
    const homeLastTs = lastFinishedTs(homeLast);
    const awayLastTs = lastFinishedTs(awayLast);

    const countUpcoming = (evs: SofaEventWithScore[]): number => {
      const cutoff = now + CONGESTION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
      return evs.filter((e) => {
        const ts = e.startTimestamp * 1000;
        return ts >= now && ts <= cutoff;
      }).length;
    };

    const intangibles: Intangibles = {
      matchId,
      homeRestDays: homeLastTs !== null ? daysBetween(now, homeLastTs) : undefined,
      awayRestDays: awayLastTs !== null ? daysBetween(now, awayLastTs) : undefined,
      homeCongestion: countUpcoming(homeNext),
      awayCongestion: countUpcoming(awayNext),
      homeInjuries: [],
      awayInjuries: [],
    };

    await historyCacheRepo
      .upsert({
        cacheKey,
        payload: intangibles,
        fetchedAt: new Date().toISOString(),
      })
      .catch(() => undefined);
    return intangibles;
  },
});
