import { z } from "zod";
import { BookId, type MatchId } from "@/domain/ids";
import type { MarketKey, Selection } from "@/domain/market";
import type { BookOffer, LineSnapshot } from "@/domain/odds";
import { httpRequest, HttpError } from "@/services/http/httpClient";
import { oddsApiIoQuota } from "@/services/http/quotaTracker";
import type {
  OddsProvider,
  ProviderEvent,
  QuotaSnapshot,
} from "@/services/providers/OddsProvider";

const IO_BASE = "https://api.odds-api.io/v3";

/**
 * Mapping from our MarketKey to the API's market key. odds-api.io is not
 * officially documented at the soccer-market-key level; the names below are
 * the most plausible based on how peer APIs (the-odds-api v4) spell them and
 * will be re-tuned once we have real fixtures in dev. `parseMarketKey` below
 * is permissive so unknown aliases do not throw, they just log and skip.
 */
const MARKET_TO_API: Partial<Record<MarketKey, string[]>> = {
  ML_1X2: ["h2h", "moneyline", "1x2"],
  AH: ["spreads", "handicap", "asian_handicap", "ah"],
  OU_GOALS: ["totals", "ou", "over_under", "goals_over_under"],
  BTTS: ["btts", "both_teams_to_score"],
  DNB: ["draw_no_bet", "dnb"],
};

const ioOutcomeSchema = z
  .object({
    name: z.string(),
    price: z.number(),
    point: z.number().optional(),
    line: z.number().optional(),
  })
  .passthrough();

const ioMarketSchema = z
  .object({
    key: z.string(),
    outcomes: z.array(ioOutcomeSchema),
    last_update: z.string().optional(),
    lastUpdate: z.string().optional(),
  })
  .passthrough();

const ioBookmakerSchema = z
  .object({
    key: z.string(),
    title: z.string().optional(),
    markets: z.array(ioMarketSchema),
    last_update: z.string().optional(),
    lastUpdate: z.string().optional(),
  })
  .passthrough();

const ioEventOddsSchema = z
  .object({
    id: z.string().optional(),
    eventId: z.string().optional(),
    home_team: z.string().optional(),
    away_team: z.string().optional(),
    home: z.string().optional(),
    away: z.string().optional(),
    homeTeam: z.string().optional(),
    awayTeam: z.string().optional(),
    bookmakers: z.array(ioBookmakerSchema).optional(),
    commence_time: z.string().optional(),
    startTime: z.string().optional(),
  })
  .passthrough();

const ioEventListItemSchema = z
  .object({
    id: z.string().optional(),
    eventId: z.string().optional(),
    home_team: z.string().optional(),
    away_team: z.string().optional(),
    home: z.string().optional(),
    away: z.string().optional(),
    homeTeam: z.string().optional(),
    awayTeam: z.string().optional(),
    commence_time: z.string().optional(),
    startTime: z.string().optional(),
    kickoffAt: z.string().optional(),
  })
  .passthrough();

const ioEventListSchema = z.array(ioEventListItemSchema);

const parseOddsApiIoError = (body: string): string | null => {
  try {
    const parsed = JSON.parse(body) as { message?: string; error?: string };
    if (parsed.message) return parsed.message;
    if (parsed.error) return parsed.error;
  } catch {
    /* fall through */
  }
  return null;
};

const resolveMarketKey = (apiKey: string): MarketKey | null => {
  const lower = apiKey.toLowerCase();
  for (const [ourKey, aliases] of Object.entries(MARKET_TO_API) as [
    MarketKey,
    string[],
  ][]) {
    if (aliases.includes(lower)) return ourKey;
  }
  return null;
};

const toSelection = (
  marketKey: MarketKey,
  outcomeName: string,
  line: number | undefined,
  homeName: string,
  awayName: string,
): Selection | null => {
  const lower = outcomeName.toLowerCase();
  switch (marketKey) {
    case "ML_1X2":
    case "DNB": {
      if (outcomeName === homeName || lower === "home" || lower === "1") return { marketKey, side: "home" };
      if (outcomeName === awayName || lower === "away" || lower === "2") return { marketKey, side: "away" };
      if (lower === "draw" || lower === "x") return { marketKey, side: "draw" };
      return null;
    }
    case "AH": {
      const side =
        outcomeName === homeName || lower === "home" ? "home"
        : outcomeName === awayName || lower === "away" ? "away"
        : null;
      if (!side || line === undefined) return null;
      return { marketKey, side, line };
    }
    case "OU_GOALS": {
      if (line === undefined) return null;
      if (lower === "over") return { marketKey, side: "over", line };
      if (lower === "under") return { marketKey, side: "under", line };
      return null;
    }
    case "BTTS": {
      if (lower === "yes") return { marketKey, side: "yes" };
      if (lower === "no") return { marketKey, side: "no" };
      return null;
    }
    default:
      return null;
  }
};

const pickString = (...values: (string | undefined)[]): string => {
  for (const v of values) if (v) return v;
  return "";
};

type IoEvent = z.infer<typeof ioEventOddsSchema>;

const buildSnapshots = (
  event: IoEvent,
  requested: MarketKey[],
): LineSnapshot[] => {
  const matchId = (event.eventId ?? event.id ?? "") as MatchId;
  if (!matchId) return [];
  const requestedSet = new Set(requested);
  const homeName = pickString(event.home_team, event.home, event.homeTeam);
  const awayName = pickString(event.away_team, event.away, event.awayTeam);
  const takenAt = new Date().toISOString();
  const snapshots = new Map<MarketKey, LineSnapshot>();

  for (const bookmaker of event.bookmakers ?? []) {
    for (const market of bookmaker.markets) {
      const ourKey = resolveMarketKey(market.key);
      if (!ourKey || !requestedSet.has(ourKey)) continue;
      const snap = snapshots.get(ourKey) ?? {
        matchId,
        marketKey: ourKey,
        offers: [],
        takenAt,
      };
      for (const outcome of market.outcomes) {
        const line = outcome.point ?? outcome.line;
        const sel = toSelection(ourKey, outcome.name, line, homeName, awayName);
        if (!sel) continue;
        const offer: BookOffer = {
          book: BookId(bookmaker.key),
          selection: sel,
          decimal: outcome.price,
          takenAt: market.last_update ?? market.lastUpdate ?? bookmaker.last_update ?? bookmaker.lastUpdate ?? takenAt,
        };
        snap.offers.push(offer);
      }
      snapshots.set(ourKey, snap);
    }
  }

  return [...snapshots.values()];
};

export interface OddsApiIoConfig {
  apiKey: string;
  /** Comma-separated bookmaker keys. Free tier = 2. */
  bookmakers?: string[];
  /** Sport slug. For soccer the odds-api.io slug is 'football'. */
  sportSlug?: string;
}

export const createOddsApiIoProvider = (
  configRef: () => OddsApiIoConfig | null,
): OddsProvider => {
  const buildQuery = (entries: Record<string, string | undefined>): string => {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(entries)) {
      if (v === undefined || v === "") continue;
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
    return parts.length ? `?${parts.join("&")}` : "";
  };

  const fetchEventOdds = async (
    matchId: MatchId,
    markets: MarketKey[],
  ): Promise<LineSnapshot[]> => {
    const config = configRef();
    if (!config?.apiKey) throw new Error("odds-api.io key not configured");
    const apiMarkets = markets
      .map((m) => MARKET_TO_API[m]?.[0])
      .filter((m): m is string => Boolean(m));
    if (!apiMarkets.length) return [];

    const url = `${IO_BASE}/odds${buildQuery({
      eventId: matchId,
      apiKey: config.apiKey,
      bookmakers: config.bookmakers?.join(","),
      markets: apiMarkets.join(","),
    })}`;

    try {
      const res = await httpRequest({
        url,
        rps: 0.5,
        headers: { Accept: "application/json" },
      });
      oddsApiIoQuota.observeHeaders(res.headers);
      oddsApiIoQuota.recordRequest();
      const json = await res.json();
      const parsed = ioEventOddsSchema.safeParse(json);
      if (!parsed.success) {
        console.warn("[odds-api.io] zod parse failed", parsed.error.issues.slice(0, 3));
        return [];
      }
      return buildSnapshots(parsed.data, markets);
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.status === 401 || err.status === 403) {
          throw new Error("odds-api.io rejected the API key (401/403)");
        }
        if (err.status === 429) throw new Error("odds-api.io rate limit reached (429)");
        if (err.status === 422 || err.status === 400) {
          const hint = parseOddsApiIoError(err.body);
          throw new Error(
            `odds-api.io rejected the request (${err.status})${hint ? `: ${hint}` : ""}.`,
          );
        }
      }
      throw err;
    }
  };

  const listEvents = async (sportKey: string): Promise<ProviderEvent[]> => {
    const config = configRef();
    if (!config?.apiKey) throw new Error("odds-api.io key not configured");
    const sport = config.sportSlug ?? "football";
    // sportKey (league-level) is used as an optional filter; odds-api.io
    // typically scopes by sport + optional league slug.
    const url = `${IO_BASE}/events${buildQuery({
      sport,
      apiKey: config.apiKey,
      league: sportKey,
    })}`;

    try {
      const res = await httpRequest({
        url,
        rps: 0.5,
        headers: { Accept: "application/json" },
      });
      oddsApiIoQuota.observeHeaders(res.headers);
      oddsApiIoQuota.recordRequest();
      const json = await res.json();
      const parsed = ioEventListSchema.safeParse(json);
      if (!parsed.success) {
        console.warn("[odds-api.io] events list zod parse failed", parsed.error.issues.slice(0, 3));
        return [];
      }
      return parsed.data
        .map((ev) => {
          const eventId = ev.eventId ?? ev.id;
          const homeName = pickString(ev.home_team, ev.home, ev.homeTeam);
          const awayName = pickString(ev.away_team, ev.away, ev.awayTeam);
          const kickoffAt = pickString(ev.commence_time, ev.startTime, ev.kickoffAt);
          if (!eventId || !homeName || !awayName || !kickoffAt) return null;
          return { eventId, homeName, awayName, kickoffAt };
        })
        .filter((e): e is ProviderEvent => e !== null);
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.status === 401 || err.status === 403) {
          throw new Error("odds-api.io rejected the API key (401/403)");
        }
        if (err.status === 429) throw new Error("odds-api.io rate limit reached (429)");
      }
      throw err;
    }
  };

  return {
    name: "odds-api-io",
    async getOdds(matchId, markets) {
      return fetchEventOdds(matchId, markets);
    },
    async snapshotOpeners(matchId) {
      const snaps = await fetchEventOdds(matchId, ["ML_1X2", "OU_GOALS", "AH"]);
      return snaps.map((s) => ({ ...s, isOpener: true }));
    },
    async listEvents(sportKey) {
      return listEvents(sportKey);
    },
    quota(): QuotaSnapshot {
      return oddsApiIoQuota.snapshot();
    },
  };
};
