import { z } from "zod";
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
  eventStatsCacheKey,
  formCacheKey,
  h2hCacheKey,
  historyCacheRepo,
  intangiblesCacheKey,
} from "@/storage/repos/historyCacheRepo";
import { SOFA_API_BASE } from "@/services/scrape/selectors/sofaScore.v1";
import {
  eventStatisticsUrl,
  extractXG,
  isFinishedEvent,
  readScore,
  sofaEventStatisticsSchema,
  sofaTeamEventsResponseSchema,
  teamEventsLastUrl,
  teamEventsNextUrl,
  type SofaEventWithScore,
  type SofaXG,
} from "@/services/scrape/selectors/sofaScore.v2";
import { fetchFdorgH2H } from "@/services/impl/footballDataProvider";

const PROVIDER_NAME = "sofascore";
const FORM_TTL_MS = 6 * 60 * 60 * 1000;

const sofaSearchSchema = z.object({
  results: z
    .array(
      z.object({
        type: z.string(),
        entity: z.object({ id: z.number(), name: z.string() }).passthrough(),
      }),
    )
    .optional(),
});

const teamNameToSofaId = new Map<string, number | null>();
const inflightTeamLookup = new Map<string, Promise<number | null>>();
const inflightTeamEvents = new Map<string, Promise<SofaEventWithScore[]>>();

const stripSuffixes = (name: string): string =>
  name
    .replace(/\b(FC|AFC|CF|SC|AC|RC|CD|CP|UD|IF|BK|Club|Calcio|Deportivo|Real)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

const toAscii = (name: string): string =>
  name.normalize("NFD").replace(/[̀-ͯ]/g, "");

const searchSofaTeamId = async (q: string): Promise<number | null> => {
  const url = `${SOFA_API_BASE}/search/all?q=${encodeURIComponent(q)}`;
  const raw = await fetchJson<unknown>(url);
  if (!raw) return null;
  const parsed = sofaSearchSchema.safeParse(raw);
  if (!parsed.success || !parsed.data.results) return null;
  const first = parsed.data.results.find((r) => r.type === "team");
  return first?.entity.id ?? null;
};

const resolveTeamIdByName = async (name: string): Promise<number | null> => {
  const key = name.toLowerCase().trim();
  if (teamNameToSofaId.has(key)) return teamNameToSofaId.get(key)!;
  const inflight = inflightTeamLookup.get(key);
  if (inflight) return inflight;

  const candidates = [name];
  const stripped = stripSuffixes(name);
  if (stripped.toLowerCase() !== key) candidates.push(stripped);
  const ascii = toAscii(name);
  if (ascii !== name) candidates.push(ascii);
  const asciiStripped = toAscii(stripped);
  if (asciiStripped !== stripped && asciiStripped !== ascii) candidates.push(asciiStripped);

  const lookup = (async (): Promise<number | null> => {
    let id: number | null = null;
    for (const q of candidates) {
      id = await searchSofaTeamId(q);
      if (id) break;
    }
    teamNameToSofaId.set(key, id);
    return id;
  })().finally(() => inflightTeamLookup.delete(key));

  inflightTeamLookup.set(key, lookup);
  return lookup;
};
const H2H_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const INTANGIBLES_TTL_MS = 1 * 60 * 60 * 1000;
const EVENT_STATS_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CONGESTION_WINDOW_DAYS = 7;

const clampNum = (v: number, lo: number, hi: number): number =>
  Math.min(Math.max(v, lo), hi);

const xPointsForGame = (xgFor: number, xgAgainst: number): number => {
  const diff = xgFor - xgAgainst;
  const pWin = clampNum(0.5 + diff * 0.18, 0.05, 0.95);
  const pDraw = clampNum(0.3 - Math.abs(diff) * 0.1, 0.05, 0.3);
  return pWin * 3 + pDraw;
};

const isFreshWithin = (iso: string, ttlMs: number): boolean => {
  const age = Date.now() - Date.parse(iso);
  return Number.isFinite(age) && age >= 0 && age < ttlMs;
};

const daysBetween = (a: number, b: number): number =>
  Math.max(0, Math.floor((a - b) / (24 * 60 * 60 * 1000)));

const fetchJson = async <T>(url: string, signal?: AbortSignal): Promise<T | null> => {
  try {
    const res = await httpRequest({
      url,
      rps: 1,
      preferBrowserFetch: true,
      headers: {
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal,
    });
    return (await res.json()) as T;
  } catch (err) {
    const e = err as { status?: number; message?: string };
    if (signal?.aborted) return null;
    console.warn(
      `[sofascore fetch] failed · url=${url} status=${e.status ?? "?"} msg=${e.message ?? String(err)}`,
    );
    return null;
  }
};

const fetchEventStatistics = async (eventId: number, signal?: AbortSignal): Promise<SofaXG | null> => {
  const cacheKey = eventStatsCacheKey(eventId);
  const cached = await historyCacheRepo.get<SofaXG>(cacheKey).catch(() => null);
  if (cached && isFreshWithin(cached.fetchedAt, EVENT_STATS_TTL_MS)) {
    return cached.payload;
  }
  const raw = await fetchJson<unknown>(eventStatisticsUrl(eventId), signal);
  if (!raw) return null;
  const parsed = sofaEventStatisticsSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn(`[sofascore stats] parse failed · eventId=${eventId}`);
    return null;
  }
  const xg = extractXG(parsed.data);
  if (xg) {
    await historyCacheRepo
      .upsert({ cacheKey, payload: xg, fetchedAt: new Date().toISOString() })
      .catch(() => undefined);
  }
  return xg;
};

const mapGameForTeam = (
  ev: SofaEventWithScore,
  teamId: number,
  xg?: SofaXG | null,
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
    ...(xg
      ? {
          xGFor: isHome ? xg.homeXG : xg.awayXG,
          xGAgainst: isHome ? xg.awayXG : xg.homeXG,
        }
      : {}),
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
  let xGFor = 0;
  let xGAgainst = 0;
  let xPoints = 0;
  let xGGamesCount = 0;
  for (const g of games) {
    goalsFor += g.goalsFor;
    goalsAgainst += g.goalsAgainst;
    if (g.goalsAgainst === 0) cleanSheets += 1;
    if (g.goalsFor > 0 && g.goalsAgainst > 0) bttsCount += 1;
    points += g.result === "W" ? 3 : g.result === "D" ? 1 : 0;
    if (g.xGFor !== undefined && g.xGAgainst !== undefined) {
      xGFor += g.xGFor;
      xGAgainst += g.xGAgainst;
      xPoints += xPointsForGame(g.xGFor, g.xGAgainst);
      xGGamesCount += 1;
    }
  }
  const n = games.length;
  const hasXG = xGGamesCount > 0;
  return {
    teamId,
    lastN,
    games,
    goalsFor,
    goalsAgainst,
    cleanSheets,
    bttsRate: n > 0 ? bttsCount / n : 0,
    ppgLast: n > 0 ? points / n : 0,
    pointsLast: points,
    ...(hasXG
      ? {
          xGForLast: xGFor,
          xGAgainstLast: xGAgainst,
          xPointsLast: xPoints,
        }
      : {}),
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
  signal?: AbortSignal,
): Promise<SofaEventWithScore[]> => {
  const inflight = inflightTeamEvents.get(url);
  if (inflight) return inflight;
  const promise = (async (): Promise<SofaEventWithScore[]> => {
    const raw = await fetchJson<unknown>(url, signal);
    if (!raw) return [];
    const parsed = sofaTeamEventsResponseSchema.safeParse(raw);
    if (!parsed.success) {
      console.warn(
        `[sofascore team events] zod parse failed · url=${url} issues=${parsed.error.issues.length}`,
      );
      return [];
    }
    return parsed.data.events;
  })().finally(() => inflightTeamEvents.delete(url));
  inflightTeamEvents.set(url, promise);
  return promise;
};

const H2H_PAGES_PER_TEAM = 2;

const fetchMeetingsViaTeamEvents = async (
  homeSofaId: number,
  awaySofaId: number,
  signal?: AbortSignal,
): Promise<SofaEventWithScore[]> => {
  const urls: string[] = [];
  for (let p = 0; p < H2H_PAGES_PER_TEAM; p++) {
    urls.push(teamEventsLastUrl(homeSofaId, p));
    urls.push(teamEventsLastUrl(awaySofaId, p));
  }
  const pages = await Promise.all(urls.map((u) => fetchTeamEvents(u, signal)));
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

export const createSofaScoreHistoryProvider = (fdorgApiKey?: string): HistoryProvider => ({
  name: PROVIDER_NAME,

  async getForm(teamId: TeamId, lastN: number, query?: HistoryTeamQuery): Promise<TeamForm> {
    let sofaId = query?.sofaScoreTeamId;
    if (!sofaId && query?.teamName) {
      const resolved = await resolveTeamIdByName(query.teamName);
      if (resolved) sofaId = resolved;
    }
    if (!sofaId) {
      console.warn(
        `[sofascore form] missing sofaScoreTeamId for teamId=${teamId} — returning empty form.`,
      );
      return aggregateForm(teamId, lastN, []);
    }

    const cacheKey = formCacheKey(sofaId, lastN);
    const cached = await historyCacheRepo.get<TeamForm>(cacheKey).catch(() => null);
    if (cached && isFreshWithin(cached.fetchedAt, FORM_TTL_MS)) {
      return { ...cached.payload, teamId };
    }

    const events = await fetchTeamEvents(teamEventsLastUrl(sofaId, 0), query?.signal);
    // SofaScore returns events ASC by startTimestamp. Sort DESC so "last N"
    // actually means the N most recent finished games.
    const sorted = [...events].sort(
      (a, b) => b.startTimestamp - a.startTimestamp,
    );
    const finishedSlice = sorted
      .filter((ev) => isFinishedEvent(ev))
      .slice(0, lastN);

    const statsPerEvent = await Promise.all(
      finishedSlice.map((ev) => fetchEventStatistics(ev.id, query?.signal)),
    );

    const games = finishedSlice
      .map((ev, i) => mapGameForTeam(ev, sofaId, statsPerEvent[i]))
      .filter((g): g is TeamFormGame => g !== null);

    const form = aggregateForm(teamId, lastN, games);
    await historyCacheRepo
      .upsert({ cacheKey, payload: form, fetchedAt: new Date().toISOString() })
      .catch(() => undefined);
    return form;
  },

  async getH2H(homeId: TeamId, awayId: TeamId, query?: HistoryMatchQuery): Promise<H2H> {
    const fdorgMatchId = query?.fdorgMatchId;
    const homeFdorgTeamId = query?.homeFdorgTeamId;

    if (fdorgApiKey && fdorgMatchId && homeFdorgTeamId) {
      const cacheKey = `fdorg:h2h:${fdorgMatchId}`;
      const cached = await historyCacheRepo.get<H2H>(cacheKey).catch(() => null);
      if (cached && isFreshWithin(cached.fetchedAt, H2H_TTL_MS)) {
        return { ...cached.payload, homeId, awayId };
      }
      const h2h = await fetchFdorgH2H(fdorgApiKey, fdorgMatchId, homeFdorgTeamId, homeId, awayId);
      if (h2h) {
        await historyCacheRepo
          .upsert({ cacheKey, payload: h2h, fetchedAt: new Date().toISOString() })
          .catch(() => undefined);
        return h2h;
      }
    }

    let homeSofaId = query?.homeSofaScoreId;
    let awaySofaId = query?.awaySofaScoreId;
    if (!homeSofaId && query?.homeTeamName) {
      const resolved = await resolveTeamIdByName(query.homeTeamName);
      if (resolved) homeSofaId = resolved;
    }
    if (!awaySofaId && query?.awayTeamName) {
      const resolved = await resolveTeamIdByName(query.awayTeamName);
      if (resolved) awaySofaId = resolved;
    }
    if (!homeSofaId || !awaySofaId) {
      console.warn(
        `[sofascore h2h] missing ids · homeSofaId=${homeSofaId} awaySofaId=${awaySofaId} — returning empty.`,
      );
      return aggregateH2H(homeId, awayId, []);
    }

    const cacheKey = h2hCacheKey(homeSofaId, awaySofaId);
    const cached = await historyCacheRepo.get<H2H>(cacheKey).catch(() => null);
    if (cached && isFreshWithin(cached.fetchedAt, H2H_TTL_MS)) {
      return { ...cached.payload, homeId, awayId };
    }

    const encounters = await fetchMeetingsViaTeamEvents(homeSofaId, awaySofaId, query?.signal);
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
    let homeSofaId = query?.homeSofaScoreId;
    let awaySofaId = query?.awaySofaScoreId;
    if (!homeSofaId && query?.homeTeamName) {
      const resolved = await resolveTeamIdByName(query.homeTeamName);
      if (resolved) homeSofaId = resolved;
    }
    if (!awaySofaId && query?.awayTeamName) {
      const resolved = await resolveTeamIdByName(query.awayTeamName);
      if (resolved) awaySofaId = resolved;
    }
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
      fetchTeamEvents(teamEventsLastUrl(homeSofaId, 0), query?.signal),
      fetchTeamEvents(teamEventsLastUrl(awaySofaId, 0), query?.signal),
      fetchTeamEvents(teamEventsNextUrl(homeSofaId, 0), query?.signal),
      fetchTeamEvents(teamEventsNextUrl(awaySofaId, 0), query?.signal),
    ]);

    const now = Date.now();
    // SofaScore returns events ASC by startTimestamp, so finished[0] is the
    // oldest finished match (often last season). Pick the latest one instead.
    const lastFinishedTs = (evs: SofaEventWithScore[]): number | null => {
      const finished = evs.filter(isFinishedEvent);
      if (finished.length === 0) return null;
      const latest = finished.reduce((a, b) =>
        b.startTimestamp > a.startTimestamp ? b : a,
      );
      return latest.startTimestamp * 1000;
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
