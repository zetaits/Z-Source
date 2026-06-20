// MLB StatsAPI per-game analysis feed — pitcher stats, game logs, lineups,
// player handedness, batter K-splits, and game context. Distinct from
// providers.ts (the fixtures/catalog feed): these are the per-matchup analysis
// fetches. Free, no key. Every function degrades gracefully — on HTTP or parse
// failure it console.warns and returns an empty/undefined result; callers and
// React Query treat "empty" as "not available yet" (probables, lineups and
// weather appear only as game time approaches).

import { z } from "zod";
import type {
  BatSide,
  BatterKSplits,
  DayNight,
  GameContext,
  Handedness,
  Lineup,
  LineupSlot,
  PitcherGameLog,
  PitcherSeasonStats,
  ProbablePitcher,
} from "@/domain/baseball";
import { httpRequest } from "@/services/http/httpClient";

const STATSAPI_BASE = "https://statsapi.mlb.com/api/v1";
const STATSAPI_RPS = 2; // free + generous
const ACCEPT_JSON = { Accept: "application/json" };

const currentSeason = () => new Date().getFullYear();
const num = (v: unknown): number => parseFloat(String(v ?? ""));
const toHand = (v: unknown): Handedness | undefined =>
  v === "L" || v === "R" ? v : undefined;
const toBat = (v: unknown): BatSide | undefined =>
  v === "L" || v === "R" || v === "S" ? v : undefined;

// ---------------------------------------------------------------------------
// Shared split handling. A traded player has per-team splits plus a combined
// total split (numTeams >= 2, no `team` field). Prefer the combined split so a
// season aggregates across teams; otherwise fall back to the first split.
// ---------------------------------------------------------------------------
const splitSchema = z
  .object({
    season: z.union([z.number(), z.string()]).optional(),
    numTeams: z.number().optional(),
    team: z.object({ id: z.number().optional() }).optional(),
    stat: z.record(z.unknown()).optional(),
  })
  .passthrough();
type Split = z.infer<typeof splitSchema>;

const pickCombinedSplit = (splits: Split[]): Split | undefined => {
  if (splits.length === 0) return undefined;
  const combined = splits.find((s) => (s.numTeams ?? 0) >= 2 && !s.team);
  return combined ?? splits[0];
};

const statsSchema = z
  .object({
    stats: z
      .array(z.object({ splits: z.array(splitSchema).optional() }).passthrough())
      .optional(),
  })
  .passthrough();

const firstSplits = (raw: unknown): Split[] => {
  const parsed = statsSchema.safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data.stats?.[0]?.splits ?? [];
};

// ---------------------------------------------------------------------------
// Schedule (probable pitchers + game context). One call backs both consumers.
// ---------------------------------------------------------------------------
const probablePitcherSchema = z
  .object({ id: z.number().optional(), fullName: z.string().optional() })
  .passthrough();

const scheduleGameSchema = z
  .object({
    gamePk: z.union([z.number(), z.string()]).optional(),
    dayNight: z.string().optional(),
    venue: z.object({ id: z.number().optional(), name: z.string().optional() }).optional(),
    weather: z
      .object({ temp: z.string().optional(), condition: z.string().optional(), wind: z.string().optional() })
      .optional(),
    teams: z
      .object({
        home: z.object({ probablePitcher: probablePitcherSchema.optional() }).optional(),
        away: z.object({ probablePitcher: probablePitcherSchema.optional() }).optional(),
      })
      .optional(),
  })
  .passthrough();

const scheduleSchema = z
  .object({
    dates: z.array(z.object({ games: z.array(scheduleGameSchema).optional() }).passthrough()).optional(),
  })
  .passthrough();

type ScheduleGame = z.infer<typeof scheduleGameSchema>;

const mapDayNight = (v: unknown): DayNight | undefined =>
  v === "day" || v === "night" ? v : undefined;

const mapScheduleGame = (
  g: ScheduleGame,
  fallbackPk: number,
): { probables: ProbablePitcher[]; context: GameContext } => {
  const gamePk = g.gamePk != null ? Number(g.gamePk) : fallbackPk;

  const probables: ProbablePitcher[] = [];
  const home = g.teams?.home?.probablePitcher;
  const away = g.teams?.away?.probablePitcher;
  if (home?.id != null) {
    probables.push({ playerId: home.id, name: home.fullName ?? "", teamSide: "home" });
  }
  if (away?.id != null) {
    probables.push({ playerId: away.id, name: away.fullName ?? "", teamSide: "away" });
  }

  const context: GameContext = {
    gamePk,
    venueId: g.venue?.id,
    venueName: g.venue?.name,
    dayNight: mapDayNight(g.dayNight),
  };
  // Weather is absent for future games — only attach it when present.
  if (g.weather?.condition) {
    context.weather = {
      tempF: g.weather.temp != null ? num(g.weather.temp) : undefined,
      condition: g.weather.condition,
      wind: g.weather.wind,
    };
  }
  return { probables, context };
};

const findScheduleGame = (raw: unknown, gamePk: number): ScheduleGame | undefined => {
  const parsed = scheduleSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn("[mlb-statsapi] schedule game parse failed", parsed.error.issues.slice(0, 3));
    return undefined;
  }
  const games = (parsed.data.dates ?? []).flatMap((d) => d.games ?? []);
  return games.find((g) => Number(g.gamePk) === gamePk) ?? games[0];
};

/** Probable pitchers + game context from one schedule call (avoids a double fetch). */
export const getScheduleGame = async (
  gamePk: number,
  date: string,
  signal?: AbortSignal,
): Promise<{ probables: ProbablePitcher[]; context: GameContext } | undefined> => {
  const url =
    `${STATSAPI_BASE}/schedule?sportId=1&date=${date}&gamePk=${gamePk}` +
    `&hydrate=probablePitcher,weather,venue`;
  try {
    const res = await httpRequest({ url, rps: STATSAPI_RPS, headers: ACCEPT_JSON, signal });
    const game = findScheduleGame(await res.json(), gamePk);
    if (!game) return undefined;
    return mapScheduleGame(game, gamePk);
  } catch (err) {
    console.warn("[mlb-statsapi] schedule game fetch failed", err);
    return undefined;
  }
};

/** Probable pitchers for a game; [] until announced (1-3 days pre-game). */
export const getProbablePitchers = async (
  gamePk: number,
  date: string,
  signal?: AbortSignal,
): Promise<ProbablePitcher[]> => (await getScheduleGame(gamePk, date, signal))?.probables ?? [];

/** Venue / day-night / weather context. Always returns a context (gamePk at least). */
export const getGameContext = async (
  gamePk: number,
  date: string,
  signal?: AbortSignal,
): Promise<GameContext> =>
  (await getScheduleGame(gamePk, date, signal))?.context ?? { gamePk };

// ---------------------------------------------------------------------------
// Lineups (hydrate=lineups). Empty + confirmed:false until ~1-2h pre-game.
// ---------------------------------------------------------------------------
const lineupPlayerSchema = z
  .object({
    id: z.number().optional(),
    fullName: z.string().optional(),
    primaryPosition: z.object({ abbreviation: z.string().optional() }).optional(),
  })
  .passthrough();

const lineupGameSchema = z
  .object({
    gamePk: z.union([z.number(), z.string()]).optional(),
    lineups: z
      .object({
        homePlayers: z.array(lineupPlayerSchema).optional(),
        awayPlayers: z.array(lineupPlayerSchema).optional(),
      })
      .optional(),
  })
  .passthrough();

const lineupScheduleSchema = z
  .object({
    dates: z.array(z.object({ games: z.array(lineupGameSchema).optional() }).passthrough()).optional(),
  })
  .passthrough();

type LineupPlayer = z.infer<typeof lineupPlayerSchema>;

const mapLineupSide = (players: LineupPlayer[] | undefined): LineupSlot[] =>
  (players ?? [])
    .filter((p) => p.id != null)
    .map((p, i) => ({
      battingOrder: i + 1,
      playerId: p.id as number,
      name: p.fullName ?? "",
      position: p.primaryPosition?.abbreviation,
    }));

const mapLineup = (raw: unknown, gamePk: number): Lineup => {
  const parsed = lineupScheduleSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn("[mlb-statsapi] lineup parse failed", parsed.error.issues.slice(0, 3));
    return { gamePk, home: [], away: [], confirmed: false };
  }
  const games = (parsed.data.dates ?? []).flatMap((d) => d.games ?? []);
  const game = games.find((g) => Number(g.gamePk) === gamePk) ?? games[0];
  const home = mapLineupSide(game?.lineups?.homePlayers);
  const away = mapLineupSide(game?.lineups?.awayPlayers);
  return { gamePk, home, away, confirmed: home.length > 0 || away.length > 0 };
};

/** Confirmed batting orders. {home:[], away:[], confirmed:false} until posted. */
export const getLineup = async (
  gamePk: number,
  date: string,
  signal?: AbortSignal,
): Promise<Lineup> => {
  const url = `${STATSAPI_BASE}/schedule?sportId=1&date=${date}&gamePk=${gamePk}&hydrate=lineups`;
  try {
    const res = await httpRequest({ url, rps: STATSAPI_RPS, headers: ACCEPT_JSON, signal });
    return mapLineup(await res.json(), gamePk);
  } catch (err) {
    console.warn("[mlb-statsapi] lineup fetch failed", err);
    return { gamePk, home: [], away: [], confirmed: false };
  }
};

// ---------------------------------------------------------------------------
// Pitcher season stats. inningsPitched is parseFloat of e.g. "158.0"; note that
// statsapi encodes thirds as decimals ("3.1" = 3⅓ IP), stored raw here for the
// model layer to refine. kPct is derived (strikeouts / battersFaced).
// ---------------------------------------------------------------------------
const mapPitcherSeason = (raw: unknown, playerId: number, season: number): PitcherSeasonStats | undefined => {
  const split = pickCombinedSplit(firstSplits(raw));
  if (!split?.stat) return undefined;
  const s = split.stat as Record<string, unknown>;
  const battersFaced = num(s.battersFaced);
  const strikeouts = num(s.strikeOuts);
  const numberOfPitches = s.numberOfPitches != null ? num(s.numberOfPitches) : undefined;
  return {
    playerId,
    season,
    gamesStarted: num(s.gamesStarted) || 0,
    gamesPlayed: num(s.gamesPlayed) || 0,
    inningsPitched: num(s.inningsPitched) || 0,
    battersFaced: battersFaced || 0,
    strikeouts: strikeouts || 0,
    kPct: battersFaced > 0 ? strikeouts / battersFaced : 0,
    kPer9: num(s.strikeoutsPer9Inn) || 0,
    strikePct: num(s.strikePercentage) || 0,
    numberOfPitches: Number.isNaN(numberOfPitches as number) ? undefined : numberOfPitches,
  };
};

export const getPitcherSeasonStats = async (
  playerId: number,
  season: number = currentSeason(),
  signal?: AbortSignal,
): Promise<PitcherSeasonStats | undefined> => {
  const url = `${STATSAPI_BASE}/people/${playerId}/stats?stats=season&group=pitching&season=${season}`;
  try {
    const res = await httpRequest({ url, rps: STATSAPI_RPS, headers: ACCEPT_JSON, signal });
    return mapPitcherSeason(await res.json(), playerId, season);
  } catch (err) {
    console.warn("[mlb-statsapi] pitcher season fetch failed", err);
    return undefined;
  }
};

// ---------------------------------------------------------------------------
// Pitcher game logs — filtered to starts, newest first, capped at n.
// ---------------------------------------------------------------------------
const gameLogSplitSchema = z
  .object({
    date: z.string().optional(),
    isHome: z.boolean().optional(),
    game: z.object({ gamePk: z.union([z.number(), z.string()]).optional() }).optional(),
    opponent: z.object({ name: z.string().optional() }).optional(),
    stat: z.record(z.unknown()).optional(),
  })
  .passthrough();
type GameLogSplit = z.infer<typeof gameLogSplitSchema>;

const gameLogSchema = z
  .object({
    stats: z
      .array(z.object({ splits: z.array(gameLogSplitSchema).optional() }).passthrough())
      .optional(),
  })
  .passthrough();

const mapGameLogs = (raw: unknown, n: number): PitcherGameLog[] => {
  const parsed = gameLogSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn("[mlb-statsapi] game log parse failed", parsed.error.issues.slice(0, 3));
    return [];
  }
  const splits: GameLogSplit[] = parsed.data.stats?.[0]?.splits ?? [];
  const logs: PitcherGameLog[] = [];
  for (const sp of splits) {
    const stat = (sp.stat ?? {}) as Record<string, unknown>;
    const gamesStarted = num(stat.gamesStarted) || 0;
    if (gamesStarted !== 1) continue; // starts only
    const pitches = stat.numberOfPitches != null ? num(stat.numberOfPitches) : undefined;
    logs.push({
      gamePk: sp.game?.gamePk != null ? Number(sp.game.gamePk) : 0,
      date: sp.date ?? "",
      isHome: sp.isHome ?? false,
      opponentName: sp.opponent?.name,
      inningsPitched: num(stat.inningsPitched) || 0,
      battersFaced: num(stat.battersFaced) || 0,
      strikeouts: num(stat.strikeOuts) || 0,
      pitches: Number.isNaN(pitches as number) ? undefined : pitches,
      gamesStarted,
    });
  }
  logs.sort((a, b) => b.date.localeCompare(a.date)); // newest first
  return logs.slice(0, n);
};

export const getPitcherGameLogs = async (
  playerId: number,
  n: number = 10,
  season: number = currentSeason(),
  signal?: AbortSignal,
): Promise<PitcherGameLog[]> => {
  const url = `${STATSAPI_BASE}/people/${playerId}/stats?stats=gameLog&group=pitching&season=${season}`;
  try {
    const res = await httpRequest({ url, rps: STATSAPI_RPS, headers: ACCEPT_JSON, signal });
    return mapGameLogs(await res.json(), n);
  } catch (err) {
    console.warn("[mlb-statsapi] game log fetch failed", err);
    return [];
  }
};

// ---------------------------------------------------------------------------
// Player handedness (batch bio). Map playerId -> { throws, bats }.
// ---------------------------------------------------------------------------
const personSchema = z
  .object({
    id: z.number().optional(),
    pitchHand: z.object({ code: z.string().optional() }).optional(),
    batSide: z.object({ code: z.string().optional() }).optional(),
  })
  .passthrough();

const peopleSchema = z.object({ people: z.array(personSchema).optional() }).passthrough();

const mapPlayerHands = (raw: unknown): Map<number, { throws?: Handedness; bats?: BatSide }> => {
  const out = new Map<number, { throws?: Handedness; bats?: BatSide }>();
  const parsed = peopleSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn("[mlb-statsapi] people parse failed", parsed.error.issues.slice(0, 3));
    return out;
  }
  for (const p of parsed.data.people ?? []) {
    if (p.id == null) continue;
    out.set(p.id, { throws: toHand(p.pitchHand?.code), bats: toBat(p.batSide?.code) });
  }
  return out;
};

export const getPlayerHands = async (
  playerIds: number[],
  signal?: AbortSignal,
): Promise<Map<number, { throws?: Handedness; bats?: BatSide }>> => {
  if (playerIds.length === 0) return new Map();
  const url = `${STATSAPI_BASE}/people?personIds=${playerIds.join(",")}`;
  try {
    const res = await httpRequest({ url, rps: STATSAPI_RPS, headers: ACCEPT_JSON, signal });
    return mapPlayerHands(await res.json());
  } catch (err) {
    console.warn("[mlb-statsapi] people fetch failed", err);
    return new Map();
  }
};

// ---------------------------------------------------------------------------
// Batter K% vs LHP/RHP (statSplits sitCodes=vl,vr). Savant's hand splits are
// confirmed broken, so platoon K% comes from statsapi.
// ---------------------------------------------------------------------------
const splitCodeSchema = z
  .object({
    numTeams: z.number().optional(),
    team: z.object({ id: z.number().optional() }).optional(),
    split: z.object({ code: z.string().optional() }).optional(),
    stat: z.record(z.unknown()).optional(),
  })
  .passthrough();
type SplitCode = z.infer<typeof splitCodeSchema>;

const statSplitsSchema = z
  .object({
    stats: z
      .array(z.object({ splits: z.array(splitCodeSchema).optional() }).passthrough())
      .optional(),
  })
  .passthrough();

// For a given sitCode, prefer the combined (traded) split, else first match.
const pickByCode = (splits: SplitCode[], code: string): SplitCode | undefined => {
  const matches = splits.filter((s) => s.split?.code === code);
  if (matches.length === 0) return undefined;
  return matches.find((s) => (s.numTeams ?? 0) >= 2 && !s.team) ?? matches[0];
};

const kPctFromSplit = (s: SplitCode | undefined): { k?: number; pa?: number } => {
  if (!s?.stat) return {};
  const stat = s.stat as Record<string, unknown>;
  const pa = num(stat.plateAppearances);
  const k = num(stat.strikeOuts);
  if (!(pa > 0)) return { pa: Number.isNaN(pa) ? undefined : pa };
  return { k: k / pa, pa };
};

const mapBatterKSplits = (raw: unknown, playerId: number, season: number): BatterKSplits | undefined => {
  const parsed = statSplitsSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn("[mlb-statsapi] statSplits parse failed", parsed.error.issues.slice(0, 3));
    return undefined;
  }
  const splits: SplitCode[] = parsed.data.stats?.[0]?.splits ?? [];
  if (splits.length === 0) return undefined;
  const vl = kPctFromSplit(pickByCode(splits, "vl"));
  const vr = kPctFromSplit(pickByCode(splits, "vr"));
  return { playerId, season, kPctVsL: vl.k, kPctVsR: vr.k, paVsL: vl.pa, paVsR: vr.pa };
};

export const getBatterKSplits = async (
  playerId: number,
  season: number = currentSeason(),
  signal?: AbortSignal,
): Promise<BatterKSplits | undefined> => {
  const url =
    `${STATSAPI_BASE}/people/${playerId}/stats` +
    `?stats=statSplits&group=hitting&season=${season}&sitCodes=vl,vr`;
  try {
    const res = await httpRequest({ url, rps: STATSAPI_RPS, headers: ACCEPT_JSON, signal });
    return mapBatterKSplits(await res.json(), playerId, season);
  } catch (err) {
    console.warn("[mlb-statsapi] statSplits fetch failed", err);
    return undefined;
  }
};

// Pure mappers exported for unit tests (no HTTP), per providers.ts convention.
export {
  pickCombinedSplit as _pickCombinedSplit,
  mapScheduleGame as _mapScheduleGame,
  mapLineup as _mapLineup,
  mapPitcherSeason as _mapPitcherSeason,
  mapGameLogs as _mapGameLogs,
  mapPlayerHands as _mapPlayerHands,
  mapBatterKSplits as _mapBatterKSplits,
};
