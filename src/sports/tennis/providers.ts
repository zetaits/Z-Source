// Tennis fixtures feed — odds-api.io /v3/events?sport=tennis.
// Mirrors the structure of baseball/providers.ts but hits the shared odds feed
// (no separate free API exists for tennis). Filters to ATP/WTA tour events and
// drops ITF / Futures / W25K-type sub-circuits. Each event carries its full
// league name so analyze.ts can derive tour + event level for format selection.
//
// Only allowed books: Bet365, DraftKings (plan constraint). The fixtures call
// does NOT need a bookmakers param — /events returns the event catalogue only.

import { z } from "zod";
import type { Tour } from "@/domain/tennis";
import { LeagueId } from "@/domain/ids";
import type { CatalogMatch, MatchStatus } from "@/domain/match";
import { httpRequest, HttpError } from "@/services/http/httpClient";
import { oddsApiIoQuota } from "@/services/http/quotaTracker";
import { settingsStore } from "@/services/settings/settingsStore";
import { isPersistentStorage } from "@/storage";
import { matchesCacheRepo } from "@/storage/repos/matchesCacheRepo";

const IO_BASE = "https://api.odds-api.io/v3";
const SOURCE = "tennis-odds-api-io";

// Subset of the odds-api.io event list item; mirrors ioEventListItemSchema in
// oddsApiIoProvider.ts but adds nothing extra — tennis events have the same shape.
const eventSchema = z
  .object({
    id:     z.union([z.string(), z.number()]).optional(),
    home:   z.string().optional(),   // player A (first listed)
    away:   z.string().optional(),   // player B (second listed)
    date:   z.string().optional(),   // ISO kickoff timestamp
    league: z.object({ name: z.string().optional(), slug: z.string().optional() }).optional(),
    status: z.string().optional(),
  })
  .passthrough();

const eventsListSchema = z.array(eventSchema);
type RawEvent = z.infer<typeof eventSchema>;

// ---------------------------------------------------------------------------
// League tier detection
// ---------------------------------------------------------------------------

/** Derive ATP/WTA tour from league name; null = not a main-circuit league. */
const leagueTour = (name: string): Tour | null => {
  if (/\bWTA\b/i.test(name)) return "wta";
  if (/\bATP\b/i.test(name)) return "atp";
  return null;
};

/**
 * Exclude ITF, Futures, and sub-circuit events (W15K, W25K, M15K etc.) that
 * lack the depth of odds / stat data needed for analysis.
 */
const isMainTourLeague = (name: string): boolean =>
  !(/\bITF\b|\bFutures\b|\b[MW]\d+K\b/i.test(name));

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

const mapStatus = (s: string | undefined): MatchStatus => {
  if (!s) return "SCHEDULED";
  const lc = s.toLowerCase();
  if (lc === "live" || lc === "in_play" || lc === "inplay")      return "LIVE";
  if (lc === "ft" || lc === "settled" || lc === "finished" ||
      lc === "complete" || lc === "closed")                       return "FT";
  if (lc === "postponed")                                         return "POSTPONED";
  if (lc === "cancelled" || lc === "canceled" || lc === "abandoned") return "CANCELLED";
  return "SCHEDULED";
};

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/**
 * Canonical leagueId per tour. Matches are grouped under "atp" / "wta" so the
 * Scanner can filter by tour without knowing individual tournament slugs.
 */
const tourLeagueId = (tour: Tour): string => tour;

const toCatalogMatch = (ev: RawEvent, tour: Tour): CatalogMatch | null => {
  const catalogId = ev.id !== undefined ? String(ev.id) : undefined;
  const home = ev.home;
  const away = ev.away;
  const kickoffAt = ev.date;
  if (!catalogId || !home || !away || !kickoffAt) return null;

  const leagueName =
    ev.league?.name ?? (tour === "atp" ? "ATP Tour" : "WTA Tour");

  return {
    catalogId,
    source: SOURCE,
    leagueId: LeagueId(tourLeagueId(tour)),
    leagueName,
    countryCode: "INT",
    kickoffAt,
    home: { name: home },
    away: { name: away },
    status: mapStatus(ev.status),
  };
};

// ---------------------------------------------------------------------------
// Query string builder (mirrors oddsApiIoProvider.ts)
// ---------------------------------------------------------------------------

const buildQuery = (entries: Record<string, string | undefined>): string => {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(entries)) {
    if (v === undefined || v === "") continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
};

// ---------------------------------------------------------------------------
// Public fetch
// ---------------------------------------------------------------------------

/**
 * Fetch the upcoming tennis event catalogue from odds-api.io and return it as
 * CatalogMatch[]. Degrades gracefully — on HTTP / parse failure returns [].
 * Persists to matchesCacheRepo so MatchDetail can resolve opened fixtures.
 */
export const fetchTennisWindowFixtures = async (
  signal?: AbortSignal,
): Promise<CatalogMatch[]> => {
  const settings = await settingsStore.load();
  if (!settings.oddsApiIoKey) {
    console.info("[fixtures] tennis-odds-api-io: skipped (no key)");
    return [];
  }

  const url =
    `${IO_BASE}/events` +
    buildQuery({ sport: "tennis", apiKey: settings.oddsApiIoKey });

  let raw: unknown;
  try {
    const res = await httpRequest({
      url,
      rps: 0.5,
      headers: { Accept: "application/json" },
      signal,
    });
    oddsApiIoQuota.observeHeaders(res.headers);
    oddsApiIoQuota.recordRequest();
    raw = await res.json();
  } catch (err) {
    if (err instanceof HttpError) {
      console.warn(`[fixtures] tennis-odds-api-io: HTTP ${err.status}`);
    } else {
      console.warn("[fixtures] tennis-odds-api-io: fetch failed", err);
    }
    return [];
  }

  const parsed = eventsListSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn(
      "[fixtures] tennis-odds-api-io: parse failed",
      parsed.error.issues.slice(0, 3),
    );
    return [];
  }

  const out: CatalogMatch[] = [];
  for (const ev of parsed.data) {
    const leagueName = ev.league?.name ?? "";
    const tour = leagueTour(leagueName);
    if (!tour || !isMainTourLeague(leagueName)) continue;
    const m = toCatalogMatch(ev, tour);
    if (m) out.push(m);
  }

  out.sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));
  console.info(`[fixtures] tennis-odds-api-io: ${out.length} matches`);

  if (isPersistentStorage() && out.length > 0) {
    void matchesCacheRepo.upsert(out).catch(() => {});
  }

  return out;
};

// Pure helpers exported for unit tests, per codebase convention.
export {
  leagueTour as _leagueTour,
  isMainTourLeague as _isMainTourLeague,
  mapStatus as _mapStatus,
  toCatalogMatch as _toCatalogMatch,
};
