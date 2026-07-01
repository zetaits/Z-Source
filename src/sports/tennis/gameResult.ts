// Tennis result reader for the autopilot — settles Match Winner bets from the
// odds-api.io /events feed, which carries `scores.periods` (games per set) once a
// match is settled. The /odds endpoint errors on settled events, so results MUST
// come from /events. One list fetch covers the whole slate; callers cache it per
// tick. Everything degrades gracefully to an empty map / null grade.

import { z } from "zod";
import type { BetStatus } from "@/domain/bet";
import { httpRequest, HttpError } from "@/services/http/httpClient";
import { oddsApiIoQuota } from "@/services/http/quotaTracker";

const IO_BASE = "https://api.odds-api.io/v3";

export interface TennisResult {
  eventId: string;
  status: string;
  settled: boolean;
  cancelled: boolean;
  /** Winner by sets, or null when not settled / undecided. */
  winner: "home" | "away" | null;
  homeSets: number;
  awaySets: number;
  totalGames: number;
  /** ISO kickoff, for close-window timing. */
  kickoffAt: string | null;
}

const periodSchema = z
  .object({ home: z.number().optional(), away: z.number().optional() })
  .partial()
  .passthrough();

const eventSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    date: z.string().optional(),
    status: z.string().optional(),
    scores: z
      .object({
        home: z.number().optional(),
        away: z.number().optional(),
        periods: z.record(z.string(), periodSchema).optional(),
      })
      .partial()
      .optional(),
  })
  .passthrough();

const isSettled = (s: string): boolean =>
  /settled|finished|ft|complete|closed/i.test(s);
const isCancelled = (s: string): boolean =>
  /cancel|abandon|walkover|retired/i.test(s);

const toResult = (ev: z.infer<typeof eventSchema>): TennisResult | null => {
  const eventId = ev.id !== undefined ? String(ev.id) : null;
  if (!eventId) return null;
  const status = ev.status ?? "";
  const settled = isSettled(status);
  const cancelled = isCancelled(status);
  const homeSets = ev.scores?.home ?? 0;
  const awaySets = ev.scores?.away ?? 0;
  let totalGames = 0;
  for (const p of Object.values(ev.scores?.periods ?? {})) {
    totalGames += (p.home ?? 0) + (p.away ?? 0);
  }
  const winner: "home" | "away" | null = !settled
    ? null
    : homeSets > awaySets
      ? "home"
      : awaySets > homeSets
        ? "away"
        : null;
  return {
    eventId,
    status,
    settled,
    cancelled,
    winner,
    homeSets,
    awaySets,
    totalGames,
    kickoffAt: ev.date ?? null,
  };
};

/** Fetch results for the whole tennis slate, keyed by event id. */
export const fetchTennisResults = async (
  apiKey: string,
  signal?: AbortSignal,
): Promise<Map<string, TennisResult>> => {
  if (!apiKey) return new Map();
  const url = `${IO_BASE}/events?sport=tennis&apiKey=${encodeURIComponent(apiKey)}`;
  try {
    const res = await httpRequest({ url, rps: 0.5, headers: { Accept: "application/json" }, signal });
    oddsApiIoQuota.observeHeaders(res.headers);
    oddsApiIoQuota.recordRequest();
    const parsed = z.array(eventSchema).safeParse(await res.json());
    if (!parsed.success) return new Map();
    const out = new Map<string, TennisResult>();
    for (const ev of parsed.data) {
      const r = toResult(ev);
      if (r) out.set(r.eventId, r);
    }
    return out;
  } catch (err) {
    if (err instanceof HttpError) console.warn(`[tennis/result] HTTP ${err.status}`);
    return new Map();
  }
};

/**
 * Grade a Match Winner (ML_TENNIS) bet. Returns the settled status, or null when
 * the result isn't final yet (caller retries next tick). Cancelled/walkover → VOID.
 */
export const gradeTennisMl = (
  side: string,
  r: TennisResult,
): Exclude<BetStatus, "OPEN" | "CASHOUT"> | null => {
  if (r.cancelled) return "VOID";
  if (!r.settled || !r.winner) return null;
  return side === r.winner ? "WON" : "LOST";
};
