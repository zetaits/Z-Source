// Tennis Elo ingestor — surface-segmented Elo ratings from Tennis Abstract.
//
// Jeff Sackmann's tennis_atp / tennis_wta match CSVs (the original serve-stat +
// results source) were taken down in 2026 — his GitHub account now hosts only
// tennis_MatchChartingProject. His site, however, still publishes precomputed
// Elo ratings, which is exactly the Layer-1 anchor this module needs:
//   https://tennisabstract.com/reports/atp_elo_ratings.html
//   https://tennisabstract.com/reports/wta_elo_ratings.html
// Each is a server-rendered HTML table (one row per ranked player) with overall
// Elo plus surface Elos (hard / clay / grass). We parse it directly — no JS.
//
// v1 is Elo-only: serve/return point stats are NOT sourced here (the tour-wide
// serve totals died with the CSVs), so `serveStats` is always empty and the
// match model runs its "partial" tier — Match Winner is fully Elo-driven, while
// Totals/Spread fall back to league-average serve dominance reconciled to Elo.
// Serve stats (spw/rpw/aces/DF) are a phase-2 add (MatchChartingProject / scrape).
//
// The parsed table is cached 24 h in history_cache (keyed per tour). Missing or
// malformed data yields an empty result; nothing throws.

import type { EloRatings, PlayerServeStats, Surface, Tour } from "@/domain/tennis";
import { httpRequest, HttpError } from "@/services/http/httpClient";
import { historyCacheRepo } from "@/storage/repos/historyCacheRepo";
import { isPersistentStorage } from "@/storage";

const TA_RPS = 0.5; // Tennis Abstract: be polite
const CACHE_TTL_MS = 24 * 60 * 60_000; // 24 h

const ELO_URL: Readonly<Record<Tour, string>> = {
  atp: "https://tennisabstract.com/reports/atp_elo_ratings.html",
  wta: "https://tennisabstract.com/reports/wta_elo_ratings.html",
};

// ---------------------------------------------------------------------------
// Player name normaliser — used as the map key so Tennis Abstract names and
// odds-api.io player names can be matched case/accent-insensitively.
// Mirror of baseball oddsProps.ts normalizeName.
// ---------------------------------------------------------------------------
export const normalizeName = (raw: string): string =>
  raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.,'`"'\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// ---------------------------------------------------------------------------
// Public shape (unchanged API so analyze.ts + the model are untouched)
// ---------------------------------------------------------------------------

export interface SackmannData {
  /** Normalised player name → PlayerServeStats. Empty in v1 (Elo-only). */
  serveStats: Map<string, PlayerServeStats>;
  /** Normalised player name → EloRatings (overall + surface). */
  elo: Map<string, EloRatings>;
  /** Data vintage (year fetched). */
  vintage: number;
}

interface CachePayload {
  elo: Record<string, EloRatings>;
  vintage: number;
}

// ---------------------------------------------------------------------------
// HTML table parsing
// ---------------------------------------------------------------------------
// Row layout (Tennis Abstract Elo report), 0-based <td> index:
//   0 Elo rank | 1 player link | 2 age | 3 overall Elo | 4 spacer
//   5 hElo rank | 6 Hard Elo | 7 cElo rank | 8 Clay Elo | 9 gElo rank | 10 Grass Elo
//   11+ peak / ATP rank (ignored)

const stripTags = (s: string): string =>
  s.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

const toNum = (cell: string | undefined): number | undefined => {
  if (cell === undefined) return undefined;
  const v = parseFloat(stripTags(cell));
  return Number.isFinite(v) ? v : undefined;
};

/** Parse the Elo report HTML into a name → EloRatings map. Exported for tests. */
export const parseEloReport = (
  html: string,
  isoDate: string,
): Map<string, EloRatings> => {
  const out = new Map<string, EloRatings>();
  // Only <tr> rows that carry a player link are data rows (the two other
  // player.cgi references live in a <script> click handler, outside any <tr>).
  const rowRe = /<tr[^>]*>((?:(?!<\/tr>)[\s\S])*?player\.cgi\?p=(?:(?!<\/tr>)[\s\S])*?)<\/tr>/g;
  let row: RegExpExecArray | null;
  while ((row = rowRe.exec(html)) !== null) {
    const cells = row[1].match(/<td[^>]*>[\s\S]*?<\/td>/g);
    if (!cells || cells.length < 11) continue;

    const nameMatch = cells[1].match(/player\.cgi\?p=[^>]*>([\s\S]*?)<\/a>/);
    const name = nameMatch ? stripTags(nameMatch[1]) : stripTags(cells[1]);
    if (!name) continue;

    const overall = toNum(cells[3]);
    if (overall === undefined) continue;

    const bySurface: Partial<Record<Surface, number>> = {};
    const hard = toNum(cells[6]);
    const clay = toNum(cells[8]);
    const grass = toNum(cells[10]);
    if (hard !== undefined) bySurface.hard = hard;
    if (clay !== undefined) bySurface.clay = clay;
    if (grass !== undefined) bySurface.grass = grass;

    out.set(normalizeName(name), { overall, bySurface, lastUpdated: isoDate });
  }
  return out;
};

// ---------------------------------------------------------------------------
// Fetch with 24h cache
// ---------------------------------------------------------------------------

export const fetchSackmannData = async (
  tour: Tour,
  signal?: AbortSignal,
): Promise<SackmannData> => {
  const cacheKey = `tennis:elo:${tour}`;
  const isoNow = new Date().toISOString().slice(0, 10);

  // --- Cache hit ---
  if (isPersistentStorage()) {
    const cached = await historyCacheRepo.get<CachePayload>(cacheKey);
    if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_TTL_MS) {
      return {
        serveStats: new Map(),
        elo: new Map(Object.entries(cached.payload.elo)),
        vintage: cached.payload.vintage,
      };
    }
  }

  // --- Fetch + parse ---
  let elo = new Map<string, EloRatings>();
  try {
    const res = await httpRequest({
      url: ELO_URL[tour],
      rps: TA_RPS,
      headers: { Accept: "text/html" },
      signal,
    });
    elo = parseEloReport(await res.text(), isoNow);
  } catch (err) {
    // Graceful degradation: an empty Elo map lets the model run its low tier
    // (below the confidence floor → no plays) rather than break analysis.
    if (err instanceof HttpError) {
      console.warn(`[tennis/elo] ${tour} fetch failed (HTTP ${err.status})`);
    } else {
      console.warn(`[tennis/elo] ${tour} fetch failed`, err);
    }
  }

  const vintage = new Date().getFullYear();

  // --- Cache write (best-effort) ---
  if (isPersistentStorage() && elo.size > 0) {
    const payload: CachePayload = { elo: Object.fromEntries(elo), vintage };
    void historyCacheRepo
      .upsert({ cacheKey, payload, fetchedAt: new Date().toISOString() })
      .catch(() => {});
  }

  return { serveStats: new Map(), elo, vintage };
};

// ---------------------------------------------------------------------------
// Per-player accessors (convenience lookups for analyze.ts)
// ---------------------------------------------------------------------------

/** v1 sources no serve stats — always null until the phase-2 serve feed lands. */
export const getPlayerServeStats = (
  name: string,
  data: SackmannData,
): PlayerServeStats | null => data.serveStats.get(normalizeName(name)) ?? null;

/** Look up a player's Elo ratings by display name. Returns null when absent. */
export const getPlayerElo = (
  name: string,
  data: SackmannData,
): EloRatings | null => data.elo.get(normalizeName(name)) ?? null;
