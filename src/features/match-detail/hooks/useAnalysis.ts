import { useQuery } from "@tanstack/react-query";
import { LeagueId, MatchId, TeamId } from "@/domain/ids";
import type { H2H, Intangibles, TeamForm } from "@/domain/history";
import type { CatalogMatch, Match } from "@/domain/match";
import type { MarketKey, Selection } from "@/domain/market";
import type { BookOffer, LineSnapshot } from "@/domain/odds";
import type { PlayCandidate } from "@/domain/play";
import type { Splits } from "@/domain/splits";
import type { StrategyConfig } from "@/domain/strategy";
import { findLeagueById } from "@/config/leagues";
import { DEFAULT_UNIT_BANKROLL_FRACTION, type AnalysisContext } from "@/engine/context";
import { runBondedAnalysis } from "@/engine";
import { createMockHistoryProvider } from "@/services/impl/mockHistoryProvider";
import { createMockSplitProvider } from "@/services/impl/mockSplitProvider";
import { createOddsApiProvider } from "@/services/impl/oddsApiProvider";
import type { OddsProvider } from "@/services/providers/OddsProvider";
import { createMatchResolver } from "@/services/resolver/MatchResolver";
import { settingsStore } from "@/services/settings/settingsStore";
import { isPersistentStorage } from "@/storage";
import { matchResolutionRepo } from "@/storage/repos/matchResolutionRepo";
import { snapshotsRepo, type SnapshotRow } from "@/storage/repos/snapshotsRepo";
import { loadStrategy, strategyFingerprint } from "./loadStrategy";

export type AnalysisStatus = "ok" | "no-api-key" | "unresolved" | "empty-odds" | "error";

export interface ResolutionInfo {
  oddsEventId: string | null;
  confidence: number;
  resolvedAt: string;
}

export interface AnalysisResult {
  plays: PlayCandidate[];
  lines: Partial<Record<MarketKey, LineSnapshot>>;
  openers: Partial<Record<MarketKey, LineSnapshot>>;
  splits: Partial<Record<MarketKey, Splits>>;
  homeForm?: TeamForm;
  awayForm?: TeamForm;
  h2h?: H2H;
  intangibles?: Intangibles;
  strategy: StrategyConfig;
  status: AnalysisStatus;
  message?: string;
  resolution?: ResolutionInfo;
  generatedAt: string;
}

const toMatch = (c: CatalogMatch, matchId: MatchId): Match => ({
  id: matchId,
  leagueId: LeagueId(String(c.leagueId)),
  kickoffAt: c.kickoffAt,
  home: { id: TeamId(`${c.catalogId}:home`), name: c.home.name, aliases: c.home.aliases },
  away: { id: TeamId(`${c.catalogId}:away`), name: c.away.name, aliases: c.away.aliases },
  status: c.status,
  source: c.source,
});

const indexByMarket = (snaps: LineSnapshot[]): Partial<Record<MarketKey, LineSnapshot>> => {
  const out: Partial<Record<MarketKey, LineSnapshot>> = {};
  for (const s of snaps) out[s.marketKey] = s;
  return out;
};

const persistOpeners = async (matchId: MatchId, snaps: LineSnapshot[]): Promise<void> => {
  if (!isPersistentStorage() || snaps.length === 0) return;
  const already = await snapshotsRepo.hasOpener(matchId);
  if (already) return;
  for (const snap of snaps) {
    for (const offer of snap.offers) {
      await snapshotsRepo.recordOffer({
        matchId,
        marketKey: snap.marketKey,
        selection: offer.selection,
        priceDecimal: offer.decimal,
        book: offer.book,
        takenAt: offer.takenAt,
        isOpener: true,
      });
    }
  }
};

const persistCurrent = async (matchId: MatchId, snaps: LineSnapshot[]): Promise<void> => {
  if (!isPersistentStorage() || snaps.length === 0) return;
  for (const snap of snaps) {
    for (const offer of snap.offers) {
      await snapshotsRepo.recordOffer({
        matchId,
        marketKey: snap.marketKey,
        selection: offer.selection,
        priceDecimal: offer.decimal,
        book: offer.book,
        takenAt: offer.takenAt,
        isOpener: false,
      });
    }
  }
};

const FORM_LAST_N = 6;

const indexSplits = (list: Splits[]): Partial<Record<MarketKey, Splits>> => {
  const out: Partial<Record<MarketKey, Splits>> = {};
  for (const s of list) {
    const existing = out[s.marketKey];
    out[s.marketKey] = existing
      ? { ...existing, rows: [...existing.rows, ...s.rows] }
      : s;
  }
  return out;
};

const parseSelectionFromKey = (key: string, marketKey: MarketKey): Selection => {
  const prefix = `${marketKey}:`;
  const rest = key.startsWith(prefix) ? key.slice(prefix.length) : key;
  const atIdx = rest.indexOf("@");
  if (atIdx === -1) return { marketKey, side: rest };
  const line = Number(rest.slice(atIdx + 1));
  return {
    marketKey,
    side: rest.slice(0, atIdx),
    ...(Number.isFinite(line) ? { line } : {}),
  };
};

const loadOpeners = async (
  matchId: MatchId,
): Promise<Partial<Record<MarketKey, LineSnapshot>>> => {
  if (!isPersistentStorage()) return {};
  const rows = (await snapshotsRepo.listForMatch(matchId)).filter((r) => r.isOpener);
  if (rows.length === 0) return {};
  const byMarket = new Map<MarketKey, SnapshotRow[]>();
  for (const r of rows) {
    const arr = byMarket.get(r.marketKey) ?? [];
    arr.push(r);
    byMarket.set(r.marketKey, arr);
  }
  const out: Partial<Record<MarketKey, LineSnapshot>> = {};
  for (const [marketKey, rs] of byMarket) {
    const takenAt = rs.reduce(
      (min, r) => (r.takenAt < min ? r.takenAt : min),
      rs[0].takenAt,
    );
    const offers: BookOffer[] = rs.map((r) => ({
      book: r.book,
      selection: parseSelectionFromKey(r.selectionKey, marketKey),
      decimal: r.priceDecimal,
      takenAt: r.takenAt,
    }));
    out[marketKey] = { matchId, marketKey, offers, takenAt, isOpener: true };
  }
  return out;
};

const resolveOddsEventId = async (
  match: CatalogMatch,
  oddsProvider: OddsProvider,
  sportKey: string,
): Promise<ResolutionInfo> => {
  const existing = isPersistentStorage()
    ? await matchResolutionRepo.get(match.source, match.catalogId)
    : null;
  if (existing?.oddsEventId) {
    return {
      oddsEventId: existing.oddsEventId,
      confidence: existing.confidence,
      resolvedAt: existing.resolvedAt,
    };
  }

  const resolver = createMatchResolver({
    listEvents: async () => {
      const evs = await oddsProvider.listEvents(sportKey);
      return evs.map((e) => ({
        eventId: e.eventId,
        homeName: e.homeName,
        awayName: e.awayName,
        kickoffAt: e.kickoffAt,
      }));
    },
  });
  const result = await resolver.resolve(match);
  const oddsEventId = result.matchId ? String(result.matchId) : null;
  const resolvedAt = new Date().toISOString();
  if (isPersistentStorage()) {
    await matchResolutionRepo.upsert({
      catalogSource: match.source,
      catalogId: match.catalogId,
      oddsEventId,
      confidence: result.confidence,
    });
  }
  return { oddsEventId, confidence: result.confidence, resolvedAt };
};

const runAnalysis = async (match: CatalogMatch): Promise<AnalysisResult> => {
  const strategy = await loadStrategy();
  const generatedAt = new Date().toISOString();
  const emptyResult = (status: AnalysisStatus, message?: string): AnalysisResult => ({
    plays: [],
    lines: {},
    openers: {},
    splits: {},
    strategy,
    status,
    message,
    generatedAt,
  });

  const league = findLeagueById(String(match.leagueId));
  if (!league) return emptyResult("error", `Unknown league ${match.leagueId}`);

  const settings = await settingsStore.load();
  if (!settings.oddsApiKey) return emptyResult("no-api-key");

  const oddsProvider = createOddsApiProvider(() => ({
    apiKey: settings.oddsApiKey!,
    region: settings.oddsRegion,
    oddsFormat: "decimal",
    sportKeyResolver: () => league.oddsApiKey,
  }));
  const splitProvider = createMockSplitProvider();
  const historyProvider = createMockHistoryProvider();

  let resolution: ResolutionInfo;
  try {
    resolution = await resolveOddsEventId(match, oddsProvider, league.oddsApiKey);
  } catch (err) {
    return emptyResult("error", (err as Error).message);
  }
  if (!resolution.oddsEventId) {
    const pct = Math.round(resolution.confidence * 100);
    return {
      ...emptyResult(
        "unresolved",
        `No OddsAPI event matched this fixture (best confidence ${pct}%).`,
      ),
      resolution,
    };
  }
  const matchId = MatchId(resolution.oddsEventId);
  const engineMatch = toMatch(match, matchId);

  const requestedMarkets = strategy.enabledMarkets.length > 0
    ? strategy.enabledMarkets
    : (["ML_1X2", "AH", "OU_GOALS"] as MarketKey[]);

  let snapshots: LineSnapshot[];
  try {
    snapshots = await oddsProvider.getOdds(matchId, requestedMarkets);
  } catch (err) {
    return { ...emptyResult("error", (err as Error).message), resolution };
  }

  if (snapshots.length === 0) {
    return { ...emptyResult("empty-odds", "OddsAPI returned no odds for this fixture."), resolution };
  }

  await persistOpeners(matchId, snapshots).catch(() => {});
  await persistCurrent(matchId, snapshots).catch(() => {});

  const linesByMarket: Partial<Record<MarketKey, number[]>> = {};
  for (const snap of snapshots) {
    const lines = new Set<number>();
    for (const offer of snap.offers) {
      if (offer.selection.line !== undefined) lines.add(offer.selection.line);
    }
    if (lines.size > 0) linesByMarket[snap.marketKey] = [...lines].sort((a, b) => a - b);
  }

  const [openers, splitsList, homeForm, awayForm, h2h, intangibles] = await Promise.all([
    loadOpeners(matchId).catch(() => ({})),
    splitProvider.getSplits(matchId, requestedMarkets, { linesByMarket }).catch(() => null),
    historyProvider.getForm(engineMatch.home.id, FORM_LAST_N).catch(() => undefined),
    historyProvider.getForm(engineMatch.away.id, FORM_LAST_N).catch(() => undefined),
    historyProvider.getH2H(engineMatch.home.id, engineMatch.away.id).catch(() => undefined),
    historyProvider.getIntangibles(matchId).catch(() => undefined),
  ]);

  const splits = splitsList ? indexSplits(splitsList) : {};
  const lines = indexByMarket(snapshots);

  const ctx: AnalysisContext = {
    match: engineMatch,
    strategy,
    lines,
    openers,
    splits,
    homeForm,
    awayForm,
    h2h,
    intangibles,
    unitBankrollFraction: DEFAULT_UNIT_BANKROLL_FRACTION,
    generatedAt,
  };

  const plays = runBondedAnalysis(ctx, { includePass: false });
  return {
    plays,
    lines,
    openers,
    splits,
    homeForm,
    awayForm,
    h2h,
    intangibles,
    strategy,
    status: "ok",
    resolution,
    generatedAt,
  };
};

export const useAnalysis = (
  match: CatalogMatch | null | undefined,
  opts: { enabled: boolean } = { enabled: false },
) => {
  const strategyKey = match ? match.catalogId : "none";
  return useQuery({
    queryKey: ["analysis", strategyKey] as const,
    queryFn: async () => {
      const result = await runAnalysis(match!);
      return { ...result, fingerprint: strategyFingerprint(result.strategy) };
    },
    enabled: Boolean(match) && opts.enabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
};
