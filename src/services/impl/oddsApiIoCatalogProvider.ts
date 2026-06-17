import { z } from "zod";
import type { LeagueId } from "@/domain/ids";
import type { CatalogMatch, League, MatchStatus } from "@/domain/match";
import { allLeagues, type LeagueDef } from "@/config/leagues";
import { httpRequest, HttpError } from "@/services/http/httpClient";
import { oddsApiIoQuota } from "@/services/http/quotaTracker";
import type { CatalogProvider } from "@/services/providers/CatalogProvider";

const IO_BASE = "https://api.odds-api.io/v3";

const ioLeagueSchema = z
  .object({ name: z.string().optional(), slug: z.string().optional() })
  .passthrough();

const ioEventSchema = z
  .object({
    id:     z.union([z.string(), z.number()]).optional(),
    home:   z.string().optional(),
    away:   z.string().optional(),
    homeId: z.union([z.string(), z.number()]).optional(),
    awayId: z.union([z.string(), z.number()]).optional(),
    date:   z.string().optional(),
    status: z.string().optional(),
    league: ioLeagueSchema.optional(),
  })
  .passthrough();

const ioEventListSchema = z.array(ioEventSchema);

type IoEvent = z.infer<typeof ioEventSchema>;

const mapStatus = (s?: string): MatchStatus => {
  switch (s) {
    case "settled":
      return "FT";
    case "cancelled":
      return "CANCELLED";
    case "postponed":
      return "POSTPONED";
    case "live":
      return "LIVE";
    default:
      return "SCHEDULED";
  }
};

export interface OddsApiIoCatalogConfig {
  apiKey: string;
  sportSlug?: string;
}

const fetchAllEvents = async (config: OddsApiIoCatalogConfig): Promise<IoEvent[]> => {
  const sport = config.sportSlug ?? "football";
  const url = `${IO_BASE}/events?sport=${encodeURIComponent(sport)}&apiKey=${encodeURIComponent(config.apiKey)}`;
  const masked = config.apiKey ? `${config.apiKey.slice(0, 8)}…(${config.apiKey.length} chars)` : "(empty)";
  console.info(`[odds-api.io] fetching events · key=${masked} · sport=${sport}`);

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
      console.warn("[odds-api.io catalog] /events parse failed", parsed.error.issues.slice(0, 3));
      return [];
    }
    return parsed.data;
  } catch (err) {
    if (err instanceof HttpError) {
      const detail = err.body ? ` — ${err.body.slice(0, 200)}` : "";
      if (err.status === 401 || err.status === 403)
        throw new Error(`odds-api.io ${err.status}${detail}`);
      if (err.status === 429)
        throw new Error(`odds-api.io rate limit reached (429)${detail}`);
    }
    throw err;
  }
};

const buildSlugIndex = (leagueIds: LeagueId[]): Map<string, LeagueDef> => {
  const idSet = new Set<string>(leagueIds.map((id) => String(id)));
  const map = new Map<string, LeagueDef>();
  for (const l of allLeagues()) {
    if (!idSet.has(l.id)) continue;
    for (const slug of l.oddsApiIoSlugs ?? []) {
      map.set(slug, l);
    }
  }
  return map;
};

export const createOddsApiIoCatalogProvider = (
  configRef: () => OddsApiIoCatalogConfig | null,
): CatalogProvider => ({
  name: "odds-api-io-catalog",

  async listLeagues(): Promise<League[]> {
    return allLeagues().filter((l) => (l.oddsApiIoSlugs?.length ?? 0) > 0).map((l) => ({
      id: l.id,
      name: l.name,
      countryCode: l.countryCode,
      tier: l.tier,
      oddsApiKey: l.oddsApiKey,
      sofaScoreId: l.sofaScoreId,
    }));
  },

  async listFixtures({ leagueIds, from, to }) {
    const config = configRef();
    if (!config?.apiKey) return [];

    const slugIndex = buildSlugIndex(leagueIds);
    if (slugIndex.size === 0) return [];

    const events = await fetchAllEvents(config);
    const fromMs = from.getTime();
    const toMs = to.getTime();

    const results: CatalogMatch[] = [];
    for (const ev of events) {
      const slug = ev.league?.slug;
      if (!slug) continue;
      const league = slugIndex.get(slug);
      if (!league) continue;

      const id = ev.id;
      const home = ev.home;
      const away = ev.away;
      const date = ev.date;
      if (id === undefined || !home || !away || !date) continue;

      const ts = new Date(date).getTime();
      if (Number.isNaN(ts) || ts < fromMs || ts > toMs) continue;

      results.push({
        catalogId: String(id),
        source: "odds-api-io",
        leagueId: league.id,
        leagueName: league.name,
        countryCode: league.countryCode,
        kickoffAt: new Date(ts).toISOString(),
        home: { name: home },
        away: { name: away },
        status: mapStatus(ev.status),
      });
    }
    results.sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));
    return results;
  },
});
