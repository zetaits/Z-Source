import { z } from "zod";
import { BookId, type MatchId } from "@/domain/ids";
import type { MarketKey, Selection } from "@/domain/market";
import type { BookOffer, LineSnapshot } from "@/domain/odds";
import { httpRequest, HttpError } from "@/services/http/httpClient";
import { oddsApiIoQuota } from "@/services/http/quotaTracker";
import type {
  OddsMovements,
  OddsProvider,
  ProviderEvent,
  QuotaSnapshot,
} from "@/services/providers/OddsProvider";

const IO_BASE = "https://api.odds-api.io/v3";

// Actual market name strings returned by odds-api.io (PascalCase)
// DC/TTG/BTTS halves: speculative names — odds-api.io free tier likely does not
// expose these, but a paid feed or future provider could. Adapters skip silently
// when offers are missing.
const MARKET_TO_API: Partial<Record<MarketKey, string[]>> = {
  ML_1X2: ["ML", "1X2", "Moneyline", "H2H"],
  AH:     ["Spread", "Asian Handicap", "AH", "Handicap"],
  OU_GOALS: ["Totals", "Goals Over/Under", "Goals O/U", "Over/Under", "Total"],
  BTTS:   ["BTTS", "Both Teams To Score"],
  DNB:    ["DNB", "Draw No Bet"],
  DC:     ["DC", "Double Chance"],
  TTG_HOME: ["TTG Home", "Home Team Total Goals", "Home Total"],
  TTG_AWAY: ["TTG Away", "Away Team Total Goals", "Away Total"],
  BTTS_1H: ["BTTS 1H", "BTTS 1st Half", "Both Teams To Score 1st Half"],
  BTTS_2H: ["BTTS 2H", "BTTS 2nd Half", "Both Teams To Score 2nd Half"],
};

const oddsNum = z
  .union([z.number(), z.string().transform((s) => parseFloat(s))])
  .optional();

// Each odds row inside a market (one row per line value)
const ioOddsRowSchema = z
  .object({
    home:  oddsNum,
    away:  oddsNum,
    draw:  oddsNum,
    over:  oddsNum,
    under: oddsNum,
    yes:   oddsNum,
    no:    oddsNum,
    hdp:   oddsNum,
    line:  oddsNum,
  })
  .passthrough();

// MultiMarketDto: { name, odds: OddsRow[], updatedAt? }
const ioMarketSchema = z
  .object({
    name:      z.string(),
    odds:      z.array(ioOddsRowSchema).optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();

// bookmakers is an object keyed by bookmaker slug → array of market rows
const ioEventOddsSchema = z
  .object({
    id:         z.union([z.string(), z.number()]).optional(),
    home:       z.string().optional(),
    away:       z.string().optional(),
    date:       z.string().optional(),
    bookmakers: z.record(z.string(), z.array(ioMarketSchema)).optional(),
  })
  .passthrough();

const ioLeagueSchema = z
  .object({
    name: z.string().optional(),
    slug: z.string().optional(),
  })
  .passthrough();

const ioEventListItemSchema = z
  .object({
    id:     z.union([z.string(), z.number()]).optional(),
    home:   z.string().optional(),
    away:   z.string().optional(),
    homeId: z.union([z.string(), z.number()]).optional(),
    awayId: z.union([z.string(), z.number()]).optional(),
    date:   z.string().optional(),
    league: ioLeagueSchema.optional(),
    status: z.string().optional(),
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

const ALIAS_TO_MARKET: Map<string, MarketKey> = (() => {
  const m = new Map<string, MarketKey>();
  for (const [ourKey, aliases] of Object.entries(MARKET_TO_API) as [MarketKey, string[]][]) {
    for (const a of aliases) m.set(a.toLowerCase(), ourKey);
  }
  return m;
})();

const resolveMarketKey = (apiName: string): MarketKey | null =>
  ALIAS_TO_MARKET.get(apiName.toLowerCase()) ?? null;

type IoEvent = z.infer<typeof ioEventOddsSchema>;

const MARKET_TO_MOVEMENTS_API: Partial<Record<MarketKey, string>> = {
  ML_1X2: "ML",
  AH: "Spread",
  OU_GOALS: "Totals",
};

const ioMovementSchema = z
  .object({
    home: oddsNum,
    away: oddsNum,
    draw: oddsNum,
    over: oddsNum,
    under: oddsNum,
    hdp: z.union([z.string(), z.number()]).optional(),
    timestamp: z.union([z.number(), z.string().transform((s) => parseInt(s, 10))]).optional(),
    max: z.union([z.number(), z.string()]).optional(),
  })
  .passthrough();

const ioMovementsResponseSchema = z
  .object({
    bookmaker: z.string().optional(),
    eventid: z.union([z.string(), z.number()]).optional(),
    opening: ioMovementSchema.optional(),
    latest: ioMovementSchema.optional(),
    movements: z.array(ioMovementSchema).optional(),
  })
  .passthrough();

type IoMovement = z.infer<typeof ioMovementSchema>;

const movementToOffers = (
  m: IoMovement,
  marketKey: MarketKey,
  book: BookId,
  fallbackLine: number | undefined,
): BookOffer[] => {
  const tsRaw = typeof m.timestamp === "number" ? m.timestamp : undefined;
  const takenAt = tsRaw
    ? new Date(tsRaw * 1000).toISOString()
    : new Date().toISOString();
  const hdpNum =
    m.hdp !== undefined ? Number(typeof m.hdp === "string" ? m.hdp : m.hdp) : undefined;
  const line = Number.isFinite(hdpNum) ? (hdpNum as number) : fallbackLine;
  const offers: BookOffer[] = [];
  if (marketKey === "ML_1X2") {
    if (m.home !== undefined)
      offers.push({ book, selection: { marketKey, side: "home" }, decimal: m.home, takenAt });
    if (m.away !== undefined)
      offers.push({ book, selection: { marketKey, side: "away" }, decimal: m.away, takenAt });
    if (m.draw !== undefined)
      offers.push({ book, selection: { marketKey, side: "draw" }, decimal: m.draw, takenAt });
  } else if (marketKey === "AH" && line !== undefined) {
    if (m.home !== undefined)
      offers.push({ book, selection: { marketKey, side: "home", line }, decimal: m.home, takenAt });
    if (m.away !== undefined)
      offers.push({ book, selection: { marketKey, side: "away", line }, decimal: m.away, takenAt });
  } else if (marketKey === "OU_GOALS" && line !== undefined) {
    if (m.over !== undefined)
      offers.push({ book, selection: { marketKey, side: "over", line }, decimal: m.over, takenAt });
    if (m.under !== undefined)
      offers.push({ book, selection: { marketKey, side: "under", line }, decimal: m.under, takenAt });
  }
  return offers;
};

const buildSnapshots = (event: IoEvent, requested: MarketKey[]): LineSnapshot[] => {
  const matchId = String(event.id ?? "") as MatchId;
  if (!matchId) return [];
  const requestedSet = new Set(requested);
  const takenAt = new Date().toISOString();
  const snapshots = new Map<MarketKey, LineSnapshot>();

  for (const [bookKey, markets] of Object.entries(event.bookmakers ?? {})) {
    for (const market of markets) {
      const ourKey = resolveMarketKey(market.name);
      if (!ourKey || !requestedSet.has(ourKey)) continue;

      const snap = snapshots.get(ourKey) ?? {
        matchId,
        marketKey: ourKey,
        offers: [] as BookOffer[],
        takenAt,
      };

      const book = BookId(bookKey);
      const rowTs = market.updatedAt ?? takenAt;

      const push = (sel: Selection, price: number) =>
        snap.offers.push({ book, selection: sel, decimal: price, takenAt: rowTs });

      for (const row of market.odds ?? []) {
        const line = row.hdp ?? row.line;

        if (ourKey === "ML_1X2" || ourKey === "DNB") {
          if (row.home  !== undefined) push({ marketKey: ourKey, side: "home" }, row.home);
          if (row.away  !== undefined) push({ marketKey: ourKey, side: "away" }, row.away);
          if (ourKey === "ML_1X2" && row.draw !== undefined)
            push({ marketKey: ourKey, side: "draw" }, row.draw);
        } else if (ourKey === "AH" && line !== undefined) {
          if (row.home !== undefined) push({ marketKey: ourKey, side: "home", line }, row.home);
          if (row.away !== undefined) push({ marketKey: ourKey, side: "away", line }, row.away);
        } else if (ourKey === "OU_GOALS" && line !== undefined) {
          if (row.over  !== undefined) push({ marketKey: ourKey, side: "over",  line }, row.over);
          if (row.under !== undefined) push({ marketKey: ourKey, side: "under", line }, row.under);
        } else if (ourKey === "BTTS") {
          if (row.yes !== undefined) push({ marketKey: ourKey, side: "yes" }, row.yes);
          if (row.no  !== undefined) push({ marketKey: ourKey, side: "no"  }, row.no);
        }
      }

      if (snap.offers.length > 0) snapshots.set(ourKey, snap);
    }
  }

  return [...snapshots.values()];
};

export interface OddsApiIoConfig {
  apiKey: string;
  /** Comma-separated bookmaker keys. Free tier supports 2. */
  bookmakers?: string[];
  /** Sport slug — default 'football'. */
  sportSlug?: string;
}

// Canonical display names odds-api.io expects. Lowercase key → API form.
// Multi-word books need explicit entries; single-word fall through capitalize-first.
const BOOK_DISPLAY_NAMES: Record<string, string> = {
  bet365: "Bet365",
  pinnacle: "Pinnacle",
  betfair: "Betfair",
  draftkings: "DraftKings",
  fanduel: "FanDuel",
  betmgm: "BetMGM",
  caesars: "Caesars",
  pointsbet: "PointsBet",
  unibet: "Unibet",
  williamhill: "William Hill",
  "william hill": "William Hill",
  bovada: "Bovada",
  betonline: "BetOnline",
  betrivers: "BetRivers",
  betway: "Betway",
};

const normalizeBook = (b: string): string => {
  const key = b.toLowerCase().trim();
  return BOOK_DISPLAY_NAMES[key] ?? b.charAt(0).toUpperCase() + b.slice(1);
};

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
    signal?: AbortSignal,
  ): Promise<LineSnapshot[]> => {
    const config = configRef();
    if (!config?.apiKey) throw new Error("odds-api.io key not configured");

    const bookmakersParam =
      config.bookmakers && config.bookmakers.length > 0
        ? config.bookmakers.map(normalizeBook).join(",")
        : undefined; // omit param → API returns all available bookmakers

    const url = `${IO_BASE}/odds${buildQuery({
      eventId:    matchId,
      apiKey:     config.apiKey,
      bookmakers: bookmakersParam,
    })}`;

    try {
      const res = await httpRequest({
        url,
        rps: 0.5,
        headers: { Accept: "application/json" },
        signal,
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
        if (err.status === 401 || err.status === 403)
          throw new Error("odds-api.io rejected the API key (401/403)");
        if (err.status === 429)
          throw new Error("odds-api.io rate limit reached (429)");
        if (err.status === 422 || err.status === 400) {
          const hint = parseOddsApiIoError(err.body);
          throw new Error(`odds-api.io rejected the request (${err.status})${hint ? `: ${hint}` : ""}.`);
        }
      }
      throw err;
    }
  };

  const fetchEventMovements = async (
    matchId: MatchId,
    marketKey: MarketKey,
    book: BookId,
    line: number | undefined,
    signal?: AbortSignal,
  ): Promise<OddsMovements | null> => {
    const config = configRef();
    if (!config?.apiKey) throw new Error("odds-api.io key not configured");
    const apiMarket = MARKET_TO_MOVEMENTS_API[marketKey];
    if (!apiMarket) return null;

    const url = `${IO_BASE}/odds/movements${buildQuery({
      eventId: matchId,
      apiKey: config.apiKey,
      bookmaker: normalizeBook(String(book)),
      market: apiMarket,
      marketLine: line !== undefined ? String(line) : undefined,
    })}`;

    try {
      const res = await httpRequest({
        url,
        rps: 0.5,
        headers: { Accept: "application/json" },
        signal,
      });
      oddsApiIoQuota.observeHeaders(res.headers);
      oddsApiIoQuota.recordRequest();
      const json = await res.json();
      const parsed = ioMovementsResponseSchema.safeParse(json);
      if (!parsed.success) {
        console.warn("[odds-api.io] movements zod parse failed", parsed.error.issues.slice(0, 3));
        return null;
      }
      const data = parsed.data;
      const opener = data.opening
        ? movementToOffers(data.opening, marketKey, book, line)
        : [];
      const latest = data.latest
        ? movementToOffers(data.latest, marketKey, book, line)
        : [];
      const movements = (data.movements ?? []).map((m) =>
        movementToOffers(m, marketKey, book, line),
      );
      return { opener, latest, movements };
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.status === 401 || err.status === 403)
          throw new Error("odds-api.io rejected the API key (401/403)");
        if (err.status === 429)
          throw new Error("odds-api.io rate limit reached (429)");
        if (err.status === 404) return null;
      }
      throw err;
    }
  };

  const listEvents = async (_sportKey: string, signal?: AbortSignal): Promise<ProviderEvent[]> => {
    const config = configRef();
    if (!config?.apiKey) throw new Error("odds-api.io key not configured");
    const sport = config.sportSlug ?? "football";

    const url = `${IO_BASE}/events${buildQuery({
      sport,
      apiKey: config.apiKey,
    })}`;

    try {
      const res = await httpRequest({
        url,
        rps: 0.5,
        headers: { Accept: "application/json" },
        signal,
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
          const eventId = ev.id !== undefined ? String(ev.id) : undefined;
          const homeName = ev.home ?? "";
          const awayName = ev.away ?? "";
          const kickoffAt = ev.date ?? "";
          if (!eventId || !homeName || !awayName || !kickoffAt) return null;
          return { eventId, homeName, awayName, kickoffAt };
        })
        .filter((e): e is ProviderEvent => e !== null);
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.status === 401 || err.status === 403)
          throw new Error("odds-api.io rejected the API key (401/403)");
        if (err.status === 429)
          throw new Error("odds-api.io rate limit reached (429)");
      }
      throw err;
    }
  };

  return {
    name: "odds-api-io",
    async getOdds(matchId, markets, context) {
      return fetchEventOdds(matchId, markets, context?.signal);
    },
    async snapshotOpeners(matchId, context) {
      const snaps = await fetchEventOdds(matchId, ["ML_1X2", "OU_GOALS", "AH"], context?.signal);
      return snaps.map((s) => ({ ...s, isOpener: true }));
    },
    async getMovements(matchId, marketKey, book, line, context) {
      return fetchEventMovements(matchId, marketKey, book, line, context?.signal);
    },
    async listEvents(sportKey) {
      return listEvents(sportKey);
    },
    quota(): QuotaSnapshot {
      return oddsApiIoQuota.snapshot();
    },
  };
};
