import { z } from "zod";
import { BookId, type MatchId } from "@/domain/ids";
import type { MarketKey, Selection } from "@/domain/market";
import type { BookOffer, LineSnapshot } from "@/domain/odds";
import { httpRequest, HttpError } from "@/services/http/httpClient";
import { oddsApiQuota } from "@/services/http/quotaTracker";
import type {
  OddsProvider,
  OddsRequestContext,
  ProviderEvent,
  QuotaSnapshot,
} from "@/services/providers/OddsProvider";

const ODDS_API_BASE = "https://api.the-odds-api.com/v4";

const parseOddsApiError = (body: string): string | null => {
  try {
    const parsed = JSON.parse(body) as { message?: string; error_code?: string };
    if (parsed.message) return parsed.message;
    if (parsed.error_code) return parsed.error_code;
  } catch {
    /* fall through */
  }
  return null;
};

const MARKET_TO_API: Partial<Record<MarketKey, string>> = {
  ML_1X2: "h2h",
  AH: "spreads",
  OU_GOALS: "totals",
  BTTS: "btts",
  DNB: "draw_no_bet",
};

const apiOutcomeSchema = z.object({
  name: z.string(),
  price: z.number(),
  point: z.number().optional(),
});

const apiMarketSchema = z.object({
  key: z.string(),
  last_update: z.string().optional(),
  outcomes: z.array(apiOutcomeSchema),
});

const apiBookmakerSchema = z.object({
  key: z.string(),
  title: z.string().optional(),
  last_update: z.string().optional(),
  markets: z.array(apiMarketSchema),
});

const apiEventSchema = z.object({
  id: z.string(),
  sport_key: z.string(),
  commence_time: z.string(),
  home_team: z.string(),
  away_team: z.string(),
  bookmakers: z.array(apiBookmakerSchema),
});

export const oddsEventsResponseSchema = z.array(apiEventSchema);
export type OddsEvent = z.infer<typeof apiEventSchema>;

const apiEventListItemSchema = z.object({
  id: z.string(),
  sport_key: z.string().optional(),
  commence_time: z.string(),
  home_team: z.string(),
  away_team: z.string(),
});
const apiEventListSchema = z.array(apiEventListItemSchema);

export interface OddsApiConfig {
  apiKey: string;
  region: "us" | "uk" | "eu" | "au";
  oddsFormat: "decimal";
  /** Last-resort fallback when the caller doesn't pass a sportKey via context. */
  sportKeyResolver?: (matchId: MatchId) => string | null;
}

const toSelection = (
  marketKey: MarketKey,
  outcomeName: string,
  point: number | undefined,
  homeName: string,
  awayName: string,
): Selection | null => {
  switch (marketKey) {
    case "ML_1X2":
    case "DNB": {
      if (outcomeName === homeName) return { marketKey, side: "home" };
      if (outcomeName === awayName) return { marketKey, side: "away" };
      if (outcomeName.toLowerCase() === "draw") return { marketKey, side: "draw" };
      return null;
    }
    case "AH": {
      const side = outcomeName === homeName ? "home" : outcomeName === awayName ? "away" : null;
      if (!side || point === undefined) return null;
      return { marketKey, side, line: point };
    }
    case "OU_GOALS": {
      const lower = outcomeName.toLowerCase();
      if (point === undefined) return null;
      if (lower === "over") return { marketKey, side: "over", line: point };
      if (lower === "under") return { marketKey, side: "under", line: point };
      return null;
    }
    case "BTTS": {
      const lower = outcomeName.toLowerCase();
      if (lower === "yes") return { marketKey, side: "yes" };
      if (lower === "no") return { marketKey, side: "no" };
      return null;
    }
    default:
      return null;
  }
};

const buildSnapshots = (event: OddsEvent, requested: MarketKey[]): LineSnapshot[] => {
  const requestedKeys = new Set(requested);
  const snapshots = new Map<MarketKey, LineSnapshot>();
  const takenAt = new Date().toISOString();

  for (const bookmaker of event.bookmakers) {
    for (const market of bookmaker.markets) {
      const ourKey = (Object.keys(MARKET_TO_API) as MarketKey[]).find(
        (k) => MARKET_TO_API[k] === market.key,
      );
      if (!ourKey || !requestedKeys.has(ourKey)) continue;

      const snapshot = snapshots.get(ourKey) ?? {
        matchId: event.id as MatchId,
        marketKey: ourKey,
        offers: [],
        takenAt,
      };

      for (const outcome of market.outcomes) {
        const sel = toSelection(
          ourKey,
          outcome.name,
          outcome.point,
          event.home_team,
          event.away_team,
        );
        if (!sel) continue;
        const offer: BookOffer = {
          book: BookId(bookmaker.key),
          selection: sel,
          decimal: outcome.price,
          takenAt: market.last_update ?? bookmaker.last_update ?? takenAt,
        };
        snapshot.offers.push(offer);
      }

      snapshots.set(ourKey, snapshot);
    }
  }

  return [...snapshots.values()];
};

export const createOddsApiProvider = (configRef: () => OddsApiConfig | null): OddsProvider => {
  const fetchEventOdds = async (
    matchId: MatchId,
    markets: MarketKey[],
    context?: OddsRequestContext,
  ): Promise<LineSnapshot[]> => {
    const config = configRef();
    if (!config?.apiKey) throw new Error("OddsAPI key not configured");
    const sportKey = context?.sportKey ?? config.sportKeyResolver?.(matchId) ?? null;
    if (!sportKey) throw new Error(`No sport key resolved for match ${matchId}`);

    const apiMarkets = markets
      .map((m) => MARKET_TO_API[m])
      .filter((m): m is string => Boolean(m))
      .join(",");
    if (!apiMarkets) return [];

    const url = `${ODDS_API_BASE}/sports/${sportKey}/events/${matchId}/odds?apiKey=${config.apiKey}&regions=${config.region}&markets=${apiMarkets}&oddsFormat=${config.oddsFormat}`;

    try {
      const res = await httpRequest({
        url,
        rps: 0.5,
        headers: { Accept: "application/json" },
      });
      oddsApiQuota.observeHeaders(res.headers);
      const json = await res.json();
      const parsed = apiEventSchema.safeParse(json);
      if (!parsed.success) {
        console.warn("[oddsapi] zod parse failed", parsed.error.issues.slice(0, 3));
        return [];
      }
      return buildSnapshots(parsed.data, markets);
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.status === 401 || err.status === 403) {
          throw new Error("OddsAPI rejected the API key (401/403)");
        }
        if (err.status === 429) throw new Error("OddsAPI quota exhausted (429)");
        if (err.status === 422) {
          const hint = parseOddsApiError(err.body);
          throw new Error(
            `OddsAPI rejected the markets request (422)${hint ? `: ${hint}` : ""}. ` +
              `Requested ${apiMarkets}. Some markets may require a paid plan — disable them in Strategy.`,
          );
        }
      }
      throw err;
    }
  };

  const listEvents = async (sportKey: string): Promise<ProviderEvent[]> => {
    const config = configRef();
    if (!config?.apiKey) throw new Error("OddsAPI key not configured");
    const url = `${ODDS_API_BASE}/sports/${sportKey}/events?apiKey=${config.apiKey}&dateFormat=iso`;
    try {
      const res = await httpRequest({
        url,
        rps: 0.5,
        headers: { Accept: "application/json" },
      });
      oddsApiQuota.observeHeaders(res.headers);
      const json = await res.json();
      const parsed = apiEventListSchema.safeParse(json);
      if (!parsed.success) {
        console.warn("[oddsapi] events list zod parse failed", parsed.error.issues.slice(0, 3));
        return [];
      }
      return parsed.data.map((ev) => ({
        eventId: ev.id,
        homeName: ev.home_team,
        awayName: ev.away_team,
        kickoffAt: ev.commence_time,
      }));
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.status === 401 || err.status === 403) {
          throw new Error("OddsAPI rejected the API key (401/403)");
        }
        if (err.status === 429) throw new Error("OddsAPI quota exhausted (429)");
      }
      throw err;
    }
  };

  return {
    name: "the-odds-api",
    async getOdds(matchId, markets, context) {
      return fetchEventOdds(matchId, markets, context);
    },
    async snapshotOpeners(matchId, context) {
      const snaps = await fetchEventOdds(matchId, ["ML_1X2", "OU_GOALS", "AH"], context);
      return snaps.map((s) => ({ ...s, isOpener: true }));
    },
    async listEvents(sportKey) {
      return listEvents(sportKey);
    },
    quota(): QuotaSnapshot {
      return oddsApiQuota.snapshot();
    },
  };
};
