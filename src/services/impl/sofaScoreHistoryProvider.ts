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
import {
  normalizeTeamName,
  normalizedTokens,
  teamSimilarity,
} from "@/services/resolver/teamNameNormalizer";
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

export const _resetSofaScoreProviderCachesForTests = (): void => {
  teamNameToSofaId.clear();
  inflightTeamLookup.clear();
  inflightTeamEvents.clear();
};

interface SofaTeamHit {
  id: number;
  name: string;
}

interface ResolvedTeam {
  sofaTeamId: number;
  originalNames: string[];
  confidence: number;
  resolvedAt: string;
}

const RESOLVE_THRESHOLD = 0.75;
const RESOLVE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const RESOLVE_CACHE_PREFIX = "team-resolve:sofascore:";

const resolveCacheKey = (normalized: string): string =>
  `${RESOLVE_CACHE_PREFIX}${normalized}`;

// Generates progressively-shorter query candidates so SofaScore search can hit
// even when the canonical catalog name carries extra tokens (e.g. city suffix
// "Seville", brand prefix). Order: full → prefix drop-last → suffix drop-first
// → 2-token windows → single most-distinctive token.
const buildQueryCandidates = (name: string, normalized: string): string[] => {
  const out = new Set<string>();
  if (name.trim().length > 0) out.add(name.trim());
  if (normalized.length > 0) out.add(normalized);
  const tokens = normalizedTokens(name);
  if (tokens.length >= 2) {
    out.add(tokens.slice(0, -1).join(" "));
    out.add(tokens.slice(1).join(" "));
  }
  if (tokens.length >= 3) {
    for (let i = 0; i <= tokens.length - 2; i++) {
      out.add(tokens.slice(i, i + 2).join(" "));
    }
  }
  // Final fallback: single longest token (most distinctive).
  if (tokens.length > 0) {
    const longest = [...tokens].sort((a, b) => b.length - a.length)[0];
    if (longest.length >= 4) out.add(longest);
  }
  return Array.from(out);
};

// Returns null on a transient fetch failure (403/network), [] on a successful
// search with no team results. Callers must not cache a null return as a
// definitive "no such team".
const searchSofaTeamHits = async (q: string): Promise<SofaTeamHit[] | null> => {
  const url = `${SOFA_API_BASE}/search/all?q=${encodeURIComponent(q)}`;
  const raw = await fetchJson<unknown>(url);
  if (!raw) return null;
  const parsed = sofaSearchSchema.safeParse(raw);
  if (!parsed.success || !parsed.data.results) return [];
  return parsed.data.results
    .filter((r) => r.type === "team")
    .map((r) => ({ id: r.entity.id, name: r.entity.name }));
};

const rankHits = (
  input: string,
  hits: SofaTeamHit[],
): Array<{ hit: SofaTeamHit; score: number }> =>
  hits
    .map((hit) => ({ hit, score: teamSimilarity(input, hit.name) }))
    .sort((a, b) => b.score - a.score);

const resolveTeamIdByName = async (name: string): Promise<number | null> => {
  const normalized = normalizeTeamName(name);
  if (!normalized) return null;
  const cacheKey = resolveCacheKey(normalized);

  if (teamNameToSofaId.has(normalized)) {
    const cached = teamNameToSofaId.get(normalized);
    return cached ?? null;
  }
  const inflight = inflightTeamLookup.get(normalized);
  if (inflight) return inflight;

  const lookup = (async (): Promise<number | null> => {
    const persisted = await historyCacheRepo
      .get<ResolvedTeam>(cacheKey)
      .catch(() => null);
    if (persisted && isFreshWithin(persisted.fetchedAt, RESOLVE_TTL_MS)) {
      teamNameToSofaId.set(normalized, persisted.payload.sofaTeamId);
      if (!persisted.payload.originalNames.includes(name)) {
        await historyCacheRepo
          .upsert<ResolvedTeam>({
            cacheKey,
            payload: {
              ...persisted.payload,
              originalNames: [...persisted.payload.originalNames, name],
            },
            fetchedAt: persisted.fetchedAt,
          })
          .catch(() => {});
      }
      return persisted.payload.sofaTeamId;
    }

    const queries = buildQueryCandidates(name, normalized);

    let bestScore = 0;
    let bestHit: SofaTeamHit | null = null;
    let searchFailed = false;
    const topCandidates: Array<{ name: string; score: number }> = [];

    for (const q of queries) {
      const hits = await searchSofaTeamHits(q);
      if (hits === null) {
        searchFailed = true;
        continue;
      }
      if (hits.length === 0) continue;
      const ranked = rankHits(name, hits);
      for (const r of ranked.slice(0, 5)) {
        topCandidates.push({ name: r.hit.name, score: r.score });
      }
      const top = ranked[0];
      if (top && top.score > bestScore) {
        bestScore = top.score;
        bestHit = top.hit;
      }
      if (bestScore >= 0.95) break;
    }

    if (!bestHit || bestScore < RESOLVE_THRESHOLD) {
      const top3 = topCandidates
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((c) => `"${c.name}" ${c.score.toFixed(2)}`)
        .join(", ");
      console.warn(
        `[sofascore resolve] no match for "${name}" (normalized "${normalized}"). Top: [${top3 || "none"}]. Threshold ${RESOLVE_THRESHOLD}.${searchFailed ? " (search failed; not caching)" : ""}`,
      );
      // Only memoize a definitive negative. A transient search failure (e.g. the
      // proxy not yet cleared) must stay retryable, otherwise one boot-time 403
      // poisons the name for the rest of the session.
      if (!searchFailed) teamNameToSofaId.set(normalized, null);
      return null;
    }

    teamNameToSofaId.set(normalized, bestHit.id);
    await historyCacheRepo
      .upsert<ResolvedTeam>({
        cacheKey,
        payload: {
          sofaTeamId: bestHit.id,
          originalNames: [name],
          confidence: bestScore,
          resolvedAt: new Date().toISOString(),
        },
        fetchedAt: new Date().toISOString(),
      })
      .catch(() => {});
    return bestHit.id;
  })().finally(() => inflightTeamLookup.delete(normalized));

  inflightTeamLookup.set(normalized, lookup);
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
      rotateUA: true,
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

const H2H_PAGES_PER_TEAM = 4;

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
    if (!query?.forceRefresh) {
      const cached = await historyCacheRepo.get<TeamForm>(cacheKey).catch(() => null);
      if (cached && isFreshWithin(cached.fetchedAt, FORM_TTL_MS)) {
        return { ...cached.payload, teamId };
      }
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
      const cacheKey = `fdorg:h2h:v2:${fdorgMatchId}`;
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
    if (!query?.forceRefresh) {
      const cached = await historyCacheRepo.get<H2H>(cacheKey).catch(() => null);
      if (cached && isFreshWithin(cached.fetchedAt, H2H_TTL_MS)) {
        return { ...cached.payload, homeId, awayId };
      }
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
