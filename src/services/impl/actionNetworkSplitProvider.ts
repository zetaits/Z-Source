import type { MatchId } from "@/domain/ids";
import type { MarketKey } from "@/domain/market";
import type { Splits, SplitData } from "@/domain/splits";
import type {
  SplitProvider,
  SplitProviderCapabilities,
  SplitProviderQuery,
} from "@/services/providers/SplitProvider";
import { httpRequest } from "@/services/http/httpClient";
import { teamSimilarity } from "@/services/resolver/teamNameNormalizer";
import { splitsCacheRepo } from "@/storage/repos/splitsCacheRepo";
import {
  actionNetworkPublicBettingApiUrl,
  anBookLabel,
  anPublicBettingResponseSchema,
  extractMlSplits,
  type AnGame,
  type AnMlSplits,
  type AnMlRow,
} from "@/services/scrape/selectors/actionNetwork.v2";

const PROVIDER_ID = "action-network";
const SUPPORTED: MarketKey[] = ["ML_1X2"];
const CACHE_TTL_MS = 10 * 60 * 1000;
const MATCH_THRESHOLD = 0.82;

const CAPS: SplitProviderCapabilities = {
  markets: SUPPORTED,
  hasHandle: false,
  hasMoneyPct: true,
};

const yyyyMmDdUtc = (iso: string): string => iso.slice(0, 10);

const isFresh = (iso: string): boolean => {
  const age = Date.now() - Date.parse(iso);
  return Number.isFinite(age) && age >= 0 && age < CACHE_TTL_MS;
};

interface ScoredMatch {
  game: AnGame;
  splits: AnMlSplits;
  score: number;
}

const bestMatch = (
  games: AnGame[],
  homeName: string,
  awayName: string,
): ScoredMatch | null => {
  let best: ScoredMatch | null = null;
  for (const game of games) {
    const splits = extractMlSplits(game);
    if (!splits) continue;
    const score = Math.min(
      teamSimilarity(splits.homeTeamName, homeName),
      teamSimilarity(splits.awayTeamName, awayName),
    );
    if (!best || score > best.score) {
      best = { game, splits, score };
    }
  }
  if (!best || best.score < MATCH_THRESHOLD) return null;
  return best;
};

const rowToSplitData = (r: AnMlRow): SplitData => ({
  selection: { marketKey: "ML_1X2", side: r.side },
  betsPct: r.betsPct ?? undefined,
  moneyPct: r.moneyPct ?? undefined,
});

const buildMlRows = (splits: AnMlSplits): SplitData[] =>
  splits.rows
    .filter((r) => r.betsPct !== null || r.moneyPct !== null)
    .map(rowToSplitData);

const fetchActionNetwork = async (
  dateYyyyMmDd: string,
): Promise<AnGame[] | null> => {
  const url = actionNetworkPublicBettingApiUrl(dateYyyyMmDd);
  const res = await httpRequest({
    url,
    rps: 1,
    preferBrowserFetch: true,
    headers: { Accept: "application/json" },
  });
  if (res.status !== 200) {
    console.warn(`[action-network] HTTP ${res.status} · url=${url}`);
    return null;
  }
  const json = (await res.json()) as unknown;
  const parsed = anPublicBettingResponseSchema.safeParse(json);
  if (!parsed.success) {
    const sample = parsed.error.issues.slice(0, 3).map((i) => ({
      path: i.path.join("."),
      code: i.code,
      message: i.message,
    }));
    console.warn(
      `[action-network] zod parse failed · issues=${parsed.error.issues.length}`,
      sample,
    );
    return null;
  }
  return parsed.data.games;
};

const readCacheFor = async (
  matchId: MatchId,
  markets: MarketKey[],
): Promise<Splits[] | null> => {
  const hits: Splits[] = [];
  for (const m of markets) {
    const row = await splitsCacheRepo.get(matchId, m, PROVIDER_ID);
    if (!row || !isFresh(row.fetchedAt)) return null;
    hits.push(row.payload);
  }
  return hits;
};

export const createActionNetworkSplitProvider = (): SplitProvider => ({
  name: "ActionNetwork",
  capabilities: CAPS,
  async getSplits(
    matchId: MatchId,
    markets: MarketKey[],
    query?: SplitProviderQuery,
  ): Promise<Splits[] | null> {
    const supported = markets.filter((m) => SUPPORTED.includes(m));
    if (supported.length === 0) return [];

    const ctx = query?.matchContext;
    if (!ctx) return null;

    const cached = await readCacheFor(matchId, supported);
    if (cached) return cached;

    const day = yyyyMmDdUtc(ctx.kickoffAt);
    let games: AnGame[] | null;
    try {
      games = await fetchActionNetwork(day);
    } catch (err) {
      console.warn(`[action-network] fetch threw · ${(err as Error).message}`);
      return null;
    }
    if (!games || games.length === 0) return null;

    const match = bestMatch(games, ctx.homeName, ctx.awayName);
    if (!match) {
      console.warn(
        `[action-network] no fuzzy match · home="${ctx.homeName}" away="${ctx.awayName}" candidates=${games.length}`,
      );
      return null;
    }

    const rows = buildMlRows(match.splits);
    if (rows.length === 0) return null;

    const takenAt = new Date().toISOString();
    const splits: Splits = {
      matchId,
      marketKey: "ML_1X2",
      rows,
      source: PROVIDER_ID,
      bookId: anBookLabel(match.splits.bookId),
      takenAt,
    };
    await splitsCacheRepo
      .upsert({
        matchId,
        marketKey: "ML_1X2",
        providerId: PROVIDER_ID,
        payload: splits,
        fetchedAt: takenAt,
      })
      .catch(() => undefined);
    return [splits];
  },
});
