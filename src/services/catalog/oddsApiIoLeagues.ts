import { z } from "zod";
import { LeagueId } from "@/domain/ids";
import { LEAGUES, type LeagueDef } from "@/config/leagues";
import { httpRequest } from "@/services/http/httpClient";
import { registerDiscovered } from "@/services/catalog/discoveredLeagues";
import { settingsStore } from "@/services/settings/settingsStore";
import { queryClient } from "@/services/cache/queryClient";

const IO_BASE = "https://api.odds-api.io/v3";

// Lightweight catalog of every competition the odds provider prices. This is
// the universe of priceable matches: anything here can be surfaced and resolved
// by team name downstream. ~370 entries, ~37 KB — far cheaper than the full
// /events feed used for fixtures.
const ioLeagueSchema = z
  .object({
    name: z.string(),
    slug: z.string(),
    eventsCount: z.number().optional(),
  })
  .passthrough();

const ioLeaguesResponseSchema = z.array(ioLeagueSchema);

// Top competitions worth auto-enabling. Patterns (not ids) so the set stays
// tiny and stable as the provider re-slugs competitions by season/stage.
const TOP_INCLUDE =
  /world cup|uefa champions league|uefa europa league|uefa (europa )?conference league|conmebol libertadores|conmebol sudamericana|copa america|european championship|\beuro\b|nations league|club world cup|africa cup of nations|\bafcon\b|asian cup|gold cup/i;

// Never auto-enable (and don't tier-promote) age-grade, women's, or filler comps.
const NOISE =
  /women|\bu-?1[5-9]\b|\bu-?2[0-3]\b|youth|amateur|reserve|friendl|futsal|beach|esoccer|simulated/i;

// Name prefix (before " - ") → display code for the FlagChip. Falls back to the
// first three letters, or "INT" for international/world competitions.
const PREFIX_CC: Record<string, string> = {
  England: "GB-ENG",
  Scotland: "GB-SCO",
  Wales: "GB-WAL",
  "Northern Ireland": "GB-NIR",
  Spain: "ES",
  Italy: "IT",
  Germany: "DE",
  France: "FR",
  Netherlands: "NL",
  Portugal: "PT",
  Belgium: "BE",
  Brazil: "BR",
  Argentina: "AR",
  USA: "US",
  Mexico: "MX",
  "Republic of Korea": "KR",
  Japan: "JP",
  China: "CN",
  Russia: "RU",
  Turkey: "TR",
  Greece: "GR",
  Sweden: "SE",
  Norway: "NO",
  Denmark: "DK",
  Finland: "FI",
  Iceland: "IS",
  Australia: "AU",
  Chile: "CL",
  Peru: "PE",
  Colombia: "CO",
  Ecuador: "EC",
  Uruguay: "UY",
  Estonia: "EE",
  Kazakhstan: "KZ",
};

const INTL_PREFIXES = /^international/i;

const countryCodeFor = (name: string): string => {
  const prefix = name.includes(" - ") ? name.split(" - ")[0].trim() : "";
  if (!prefix) return "INT";
  if (INTL_PREFIXES.test(prefix)) return "INT";
  return PREFIX_CC[prefix] ?? prefix.slice(0, 3).toUpperCase();
};

const tierFor = (name: string): number => {
  if (NOISE.test(name)) return 3;
  if (TOP_INCLUDE.test(name)) return 0;
  return 2;
};

const isTopAutoEnable = (name: string): boolean =>
  TOP_INCLUDE.test(name) && !NOISE.test(name);

const toDiscoveredLeague = (raw: z.infer<typeof ioLeagueSchema>): LeagueDef => ({
  id: LeagueId(`io-${raw.slug}`),
  name: raw.name,
  countryCode: countryCodeFor(raw.name),
  tier: tierFor(raw.name),
  oddsApiKey: "", // unused by odds-api.io (it lists/matches globally by name)
  sofaScoreId: 0, // sentinel: discovered leagues have no SofaScore mapping
  defaultEnabled: false,
  oddsApiIoSlugs: [raw.slug],
  discovered: true,
  eventsCount: raw.eventsCount,
});

/**
 * Fetch the odds provider's league catalog and map it to discovered LeagueDefs,
 * dropping any whose slug already belongs to a curated league (curated wins).
 */
export const fetchDiscoverableLeagues = async (
  apiKey: string,
  signal?: AbortSignal,
): Promise<LeagueDef[]> => {
  const url = `${IO_BASE}/leagues?sport=football&apiKey=${encodeURIComponent(apiKey)}`;
  const res = await httpRequest({
    url,
    rps: 0.5,
    headers: { Accept: "application/json" },
    signal,
  });
  if (res.status !== 200) {
    console.warn(`[discovery] /leagues HTTP ${res.status}`);
    return [];
  }
  const parsed = ioLeaguesResponseSchema.safeParse(await res.json());
  if (!parsed.success) {
    console.warn("[discovery] /leagues parse failed", parsed.error.issues.slice(0, 3));
    return [];
  }
  const curatedSlugs = new Set(
    LEAGUES.flatMap((l) => l.oddsApiIoSlugs ?? []),
  );
  return parsed.data
    .filter((l) => !curatedSlugs.has(l.slug))
    .map(toDiscoveredLeague)
    .sort((a, b) => a.name.localeCompare(b.name));
};

const AUTO_ENABLE_MARKER = "z-source.discovery.autoEnabled.v1";

// One-shot: the first time discovery succeeds, switch on the marquee top
// competitions so they appear without the user hunting. Respects later manual
// toggles (runs once, gated by a localStorage marker).
const autoEnableTopOnce = async (discovered: LeagueDef[]): Promise<void> => {
  try {
    if (window.localStorage.getItem(AUTO_ENABLE_MARKER)) return;
  } catch {
    return; // no storage → skip silently
  }
  const topIds = discovered
    .filter((l) => isTopAutoEnable(l.name))
    .map((l) => String(l.id));
  window.localStorage.setItem(AUTO_ENABLE_MARKER, "1");
  if (topIds.length === 0) return;

  const settings = await settingsStore.load();
  const current = new Set(settings.enabledLeagueIds);
  const merged = [...settings.enabledLeagueIds];
  for (const id of topIds) if (!current.has(id)) merged.push(id);
  if (merged.length !== settings.enabledLeagueIds.length) {
    await settingsStore.update({ enabledLeagueIds: merged });
  }
};

let bootstrapped = false;

/**
 * Hydrate the discovered-league registry at startup. Failure is non-fatal —
 * the app simply stays on the curated list. Invalidates the fixtures queries so
 * the pre-discovery prefetch re-runs once auto-enabled leagues are registered.
 */
export const bootstrapDiscoveredLeagues = async (): Promise<void> => {
  if (bootstrapped) return;
  bootstrapped = true;
  try {
    const settings = await settingsStore.load();
    if (!settings.oddsApiIoKey) return;
    const discovered = await fetchDiscoverableLeagues(settings.oddsApiIoKey);
    if (discovered.length === 0) return;
    registerDiscovered(discovered);
    await autoEnableTopOnce(discovered);
    void queryClient.invalidateQueries({ queryKey: ["commandCenter", "fixtures"] });
  } catch (err) {
    console.warn("[discovery] bootstrap failed", (err as Error).message);
  }
};

export const _internals = { countryCodeFor, tierFor, isTopAutoEnable, toDiscoveredLeague };
