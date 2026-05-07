import { useQuery } from "@tanstack/react-query";
import { LeagueId, MatchId, TeamId } from "@/domain/ids";
import type { H2H, Intangibles, TeamForm } from "@/domain/history";
import type { CatalogMatch, Match } from "@/domain/match";
import type { MarketKey, Selection } from "@/domain/market";
import type { BookOffer, LineSnapshot } from "@/domain/odds";
import type { ComboPlay, PlayCandidate } from "@/domain/play";
import type { Splits } from "@/domain/splits";
import type { StrategyConfig } from "@/domain/strategy";
import { findLeagueById } from "@/config/leagues";
import { DEFAULT_UNIT_BANKROLL_FRACTION, type AnalysisContext } from "@/engine/context";
import { runBondedAnalysis } from "@/engine";
import type { OddsProvider } from "@/services/providers/OddsProvider";
import { resolveProviders } from "@/services/providers/factory";
import { createMatchResolver } from "@/services/resolver/MatchResolver";
import { settingsStore, type OddsProviderId } from "@/services/settings/settingsStore";
import { isPersistentStorage } from "@/storage";
import { matchResolutionRepo } from "@/storage/repos/matchResolutionRepo";
import { snapshotsRepo, type SnapshotRow } from "@/storage/repos/snapshotsRepo";
import { loadStrategy, strategyFingerprint } from "./loadStrategy";

export type AnalysisStatus = "ok" | "no-api-key" | "unresolved" | "empty-odds" | "error";

export interface ResolutionInfo {
  oddsProviderId: OddsProviderId;
  oddsEventId: string | null;
  confidence: number;
  resolvedAt: string;
}

export interface AnalysisResult {
  plays: PlayCandidate[];
  combos: ComboPlay[];
  lines: Partial<Record<MarketKey, LineSnapshot>>;
  openers: Partial<Record<MarketKey, LineSnapshot>>;
  splits: Partial<Record<MarketKey, Splits>>;
  splitsAvailable: boolean;
  splitsProvider: string;
  homeForm?: TeamForm;
  awayForm?: TeamForm;
  h2h?: H2H;
  intangibles?: Intangibles;
  historyAvailable: boolean;
  historyProvider: string;
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

const persistSnapshots = async (
  matchId: MatchId,
  snaps: LineSnapshot[],
  isOpener: boolean,
): Promise<void> => {
  if (!isPersistentStorage() || snaps.length === 0) return;
  if (isOpener && (await snapshotsRepo.hasOpener(matchId))) return;
  for (const snap of snaps) {
    for (const offer of snap.offers) {
      await snapshotsRepo.recordOffer({
        matchId,
        marketKey: snap.marketKey,
        selection: offer.selection,
        priceDecimal: offer.decimal,
        book: offer.book,
        takenAt: offer.takenAt,
        isOpener,
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

interface ResolutionAttempt {
  providerId: OddsProviderId;
  provider: OddsProvider;
  info: ResolutionInfo;
}

const resolveWithProvider = async (
  match: CatalogMatch,
  providerId: OddsProviderId,
  provider: OddsProvider,
  sportKey: string,
): Promise<ResolutionInfo> => {
  const existing = isPersistentStorage()
    ? await matchResolutionRepo.get(match.source, match.catalogId, providerId)
    : null;
  if (existing?.oddsEventId) {
    return {
      oddsProviderId: providerId,
      oddsEventId: existing.oddsEventId,
      confidence: existing.confidence,
      resolvedAt: existing.resolvedAt,
    };
  }

  const resolver = createMatchResolver({
    listEvents: async () => {
      const evs = await provider.listEvents(sportKey);
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
      oddsProviderId: providerId,
      oddsEventId,
      confidence: result.confidence,
    });
  }
  return { oddsProviderId: providerId, oddsEventId, confidence: result.confidence, resolvedAt };
};

const LEG_TIMEOUT_MS = 35_000;

const withTimeout = <T>(
  factory: (signal: AbortSignal) => Promise<T>,
  ms: number,
  fallback: T,
  parentSignal?: AbortSignal,
): Promise<T> => {
  const ctrl = new AbortController();
  if (parentSignal) {
    if (parentSignal.aborted) ctrl.abort();
    else parentSignal.addEventListener("abort", () => ctrl.abort(), { once: true });
  }
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      ctrl.abort();
      resolve(fallback);
    }, ms);
  });
  const work = factory(ctrl.signal).catch(() => fallback);
  return Promise.race([work, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
};

type OddsTrackResult =
  | { kind: "ok"; matchId: MatchId; snapshots: LineSnapshot[]; openers: Partial<Record<MarketKey, LineSnapshot>>; resolution: ResolutionInfo }
  | { kind: "unresolved"; bestPartial: ResolutionInfo | null; lastError: Error | null }
  | { kind: "empty-odds"; resolution: ResolutionInfo }
  | { kind: "error"; message: string; resolution?: ResolutionInfo };

const runAnalysis = async (match: CatalogMatch, parentSignal?: AbortSignal): Promise<AnalysisResult> => {
  const strategy = await loadStrategy();
  const generatedAt = new Date().toISOString();

  const baseEmpty = (): Omit<AnalysisResult, "status" | "message" | "resolution"> => ({
    plays: [],
    combos: [],
    lines: {},
    openers: {},
    splits: {},
    splitsAvailable: false,
    splitsProvider: "",
    historyAvailable: false,
    historyProvider: "",
    strategy,
    generatedAt,
  });

  const league = findLeagueById(String(match.leagueId));
  if (!league) return { ...baseEmpty(), status: "error", message: `Unknown league ${match.leagueId}` };

  const settings = await settingsStore.load();
  const { oddsComponents, splits: splitProvider, history: historyProvider } =
    resolveProviders(settings);
  const configured = oddsComponents.filter((c) => c.configured);
  if (configured.length === 0) return { ...baseEmpty(), status: "no-api-key" };

  const requestedMarkets = strategy.enabledMarkets.length > 0
    ? strategy.enabledMarkets
    : (["ML_1X2", "AH", "OU_GOALS"] as MarketKey[]);

  // Stable team IDs derived from catalog (don't need odds resolution)
  const homeTeamId = TeamId(`${match.catalogId}:home`);
  const awayTeamId = TeamId(`${match.catalogId}:away`);
  const catalogMatchId = MatchId(match.catalogId);

  // Odds resolution and history fetch run in parallel
  const [oddsTrack, homeForm, awayForm, h2h, intangibles] = await Promise.all([
    (async (): Promise<OddsTrackResult> => {
      let chosen: ResolutionAttempt | null = null;
      let bestPartial: ResolutionInfo | null = null;
      let lastError: Error | null = null;
      for (const comp of configured) {
        try {
          const info = await resolveWithProvider(match, comp.id, comp.provider, league.oddsApiKey);
          if (info.oddsEventId) {
            chosen = { providerId: comp.id, provider: comp.provider, info };
            break;
          }
          if (!bestPartial || info.confidence > bestPartial.confidence) bestPartial = info;
        } catch (err) {
          lastError = err as Error;
        }
      }
      if (!chosen) return { kind: "unresolved", bestPartial, lastError };

      const { provider: oddsProvider, info: resolution } = chosen;
      const matchId = MatchId(resolution.oddsEventId!);

      let snapshots: LineSnapshot[];
      try {
        snapshots = await oddsProvider.getOdds(matchId, requestedMarkets, {
          sportKey: league.oddsApiKey,
          signal: parentSignal,
        });
      } catch (err) {
        return { kind: "error", message: (err as Error).message, resolution };
      }

      if (snapshots.length === 0) {
        return { kind: "empty-odds", resolution };
      }

      await Promise.all([
        persistSnapshots(matchId, snapshots, true).catch(() => {}),
        persistSnapshots(matchId, snapshots, false).catch(() => {}),
      ]);
      const openers = await loadOpeners(matchId).catch(() => ({}));

      return { kind: "ok", matchId, snapshots, openers, resolution };
    })(),

    withTimeout(
      (signal) =>
        historyProvider.getForm(homeTeamId, FORM_LAST_N, {
          sofaScoreTeamId: match.home.sofaScoreId,
          teamName: match.home.name,
          signal,
        }),
      LEG_TIMEOUT_MS,
      undefined,
      parentSignal,
    ),
    withTimeout(
      (signal) =>
        historyProvider.getForm(awayTeamId, FORM_LAST_N, {
          sofaScoreTeamId: match.away.sofaScoreId,
          teamName: match.away.name,
          signal,
        }),
      LEG_TIMEOUT_MS,
      undefined,
      parentSignal,
    ),
    withTimeout(
      (signal) =>
        historyProvider.getH2H(homeTeamId, awayTeamId, {
          homeSofaScoreId: match.home.sofaScoreId,
          awaySofaScoreId: match.away.sofaScoreId,
          homeTeamName: match.home.name,
          awayTeamName: match.away.name,
          sofaEventId:
            match.source === "sofascore" ? Number(match.catalogId) : undefined,
          kickoffAt: match.kickoffAt,
          fdorgMatchId: match.fdorgMatchId,
          homeFdorgTeamId: match.home.fdorgTeamId,
          awayFdorgTeamId: match.away.fdorgTeamId,
          signal,
        }),
      LEG_TIMEOUT_MS,
      undefined,
      parentSignal,
    ),
    withTimeout(
      (signal) =>
        historyProvider.getIntangibles(catalogMatchId, {
          homeSofaScoreId: match.home.sofaScoreId,
          awaySofaScoreId: match.away.sofaScoreId,
          homeTeamName: match.home.name,
          awayTeamName: match.away.name,
          sofaEventId:
            match.source === "sofascore" ? Number(match.catalogId) : undefined,
          kickoffAt: match.kickoffAt,
          signal,
        }),
      LEG_TIMEOUT_MS,
      undefined,
      parentSignal,
    ),
  ]);

  const historyAvailable =
    (homeForm?.games.length ?? 0) > 0 ||
    (awayForm?.games.length ?? 0) > 0 ||
    (h2h?.meetings.length ?? 0) > 0 ||
    intangibles?.homeRestDays !== undefined ||
    intangibles?.awayRestDays !== undefined;

  const historyBase = {
    homeForm,
    awayForm,
    h2h,
    intangibles,
    historyAvailable,
    historyProvider: historyProvider.name,
  };

  // Non-ok odds paths: return history data but no plays
  if (oddsTrack.kind !== "ok") {
    if (oddsTrack.kind === "unresolved") {
      const pct = Math.round((oddsTrack.bestPartial?.confidence ?? 0) * 100);
      return {
        ...baseEmpty(),
        ...historyBase,
        status: "unresolved",
        message: `No odds-provider event matched this fixture (best confidence ${pct}%).`,
        resolution: oddsTrack.bestPartial ?? undefined,
      };
    }
    if (oddsTrack.kind === "empty-odds") {
      return {
        ...baseEmpty(),
        ...historyBase,
        status: "empty-odds",
        message: "Provider returned no odds for this fixture.",
        resolution: oddsTrack.resolution,
      };
    }
    return {
      ...baseEmpty(),
      ...historyBase,
      status: "error",
      message: oddsTrack.message,
      resolution: oddsTrack.resolution,
    };
  }

  const { matchId, snapshots, openers, resolution } = oddsTrack;
  const engineMatch = toMatch(match, matchId);

  const linesByMarket: Partial<Record<MarketKey, number[]>> = {};
  for (const snap of snapshots) {
    const lines = new Set<number>();
    for (const offer of snap.offers) {
      if (offer.selection.line !== undefined) lines.add(offer.selection.line);
    }
    if (lines.size > 0) linesByMarket[snap.marketKey] = [...lines].sort((a, b) => a - b);
  }

  const splitsList = await withTimeout(
    (signal) =>
      splitProvider.getSplits(matchId, requestedMarkets, {
        linesByMarket,
        matchContext: {
          homeName: engineMatch.home.name,
          awayName: engineMatch.away.name,
          kickoffAt: engineMatch.kickoffAt,
        },
        signal,
      }),
    LEG_TIMEOUT_MS,
    null,
    parentSignal,
  );

  const splits = splitsList ? indexSplits(splitsList) : {};
  const splitsAvailable = Boolean(splitsList && splitsList.length > 0);
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
    userBooks: settingsStore.get().userBooks,
    generatedAt,
  };

  const { candidates: plays, combos } = runBondedAnalysis(ctx, { includePass: false });
  return {
    plays,
    combos,
    lines,
    openers,
    splits,
    splitsAvailable,
    splitsProvider: splitProvider.name,
    ...historyBase,
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
    queryFn: async ({ signal }) => {
      const result = await runAnalysis(match!, signal);
      return { ...result, fingerprint: strategyFingerprint(result.strategy) };
    },
    enabled: Boolean(match) && opts.enabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
};
