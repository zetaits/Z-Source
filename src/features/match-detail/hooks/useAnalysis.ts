import { useQuery } from "@tanstack/react-query";
import { BookId, LeagueId, MatchId, TeamId } from "@/domain/ids";
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
import type { AnalysisDiagnostics } from "@/engine";
import {
  computeSyntheticAH,
  computeSyntheticOU,
  type SyntheticPrice,
} from "@/engine/synthetic";
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
  /** All evaluated selections including PASS — used for closest-to-threshold rail and odds-board edge overlay. */
  allCandidates: PlayCandidate[];
  combos: ComboPlay[];
  diagnostics?: AnalysisDiagnostics;
  lines: Partial<Record<MarketKey, LineSnapshot>>;
  openers: Partial<Record<MarketKey, LineSnapshot>>;
  synthetic: Partial<Record<MarketKey, SyntheticPrice[]>>;
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

const SYNTHETIC_BOOK = BookId("synthetic-poisson");

const mergeSyntheticIntoLines = (
  marketKey: "OU_GOALS" | "AH",
  realLines: LineSnapshot | undefined,
  syntheticPrices: SyntheticPrice[],
  matchId: MatchId,
  takenAt: string,
): LineSnapshot | undefined => {
  if (syntheticPrices.length === 0) return realLines;
  const realOffers = realLines?.offers ?? [];
  const existing = new Set(
    realOffers
      .filter((o) => o.selection.line !== undefined)
      .map((o) => `${o.selection.side}:${o.selection.line}`),
  );
  const syntheticOffers: BookOffer[] = syntheticPrices
    .filter((sp) => !existing.has(`${sp.side}:${sp.line}`))
    .map((sp) => ({
      book: SYNTHETIC_BOOK,
      selection: { marketKey, side: sp.side, line: sp.line },
      decimal: sp.decimal,
      takenAt,
    }));
  if (syntheticOffers.length === 0) return realLines;
  if (!realLines) {
    return { matchId, marketKey, offers: syntheticOffers, takenAt };
  }
  return { ...realLines, offers: [...realLines.offers, ...syntheticOffers] };
};

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

const BACKFILL_TARGET_MARKETS: MarketKey[] = ["ML_1X2", "AH", "OU_GOALS"];
const BACKFILL_MAX_BOOKS = 2;

const pickTopBooks = (snapshots: LineSnapshot[], max: number): string[] => {
  const counts = new Map<string, number>();
  for (const snap of snapshots) {
    for (const o of snap.offers) {
      const b = String(o.book);
      counts.set(b, (counts.get(b) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([b]) => b);
};

const pickMedianLine = (snap: LineSnapshot, book: string): number | undefined => {
  const lines = [
    ...new Set(
      snap.offers
        .filter((o) => String(o.book) === book && o.selection.line !== undefined)
        .map((o) => o.selection.line as number),
    ),
  ].sort((a, b) => a - b);
  if (lines.length === 0) return undefined;
  return lines[Math.floor(lines.length / 2)];
};

const backfillOpeners = async (
  matchId: MatchId,
  snapshots: LineSnapshot[],
  provider: OddsProvider,
  signal?: AbortSignal,
): Promise<number> => {
  if (!provider.getMovements) return 0;
  if (!isPersistentStorage()) return 0;
  if (await snapshotsRepo.hasOpener(matchId)) return 0;

  const books = pickTopBooks(snapshots, BACKFILL_MAX_BOOKS);
  if (books.length === 0) return 0;

  let persisted = 0;
  for (const book of books) {
    for (const marketKey of BACKFILL_TARGET_MARKETS) {
      const snap = snapshots.find((s) => s.marketKey === marketKey);
      if (!snap) continue;
      const needsLine = marketKey === "AH" || marketKey === "OU_GOALS";
      const line = needsLine ? pickMedianLine(snap, book) : undefined;
      if (needsLine && line === undefined) continue;

      try {
        const result = await provider.getMovements(
          matchId,
          marketKey,
          BookId(book),
          line,
          { signal },
        );
        if (!result || result.opener.length === 0) continue;
        for (const offer of result.opener) {
          await snapshotsRepo.recordOffer({
            matchId,
            marketKey,
            selection: offer.selection,
            priceDecimal: offer.decimal,
            book: offer.book,
            takenAt: offer.takenAt,
            isOpener: true,
          });
          persisted += 1;
        }
      } catch (err) {
        console.warn(
          `[backfillOpeners] ${marketKey}/${book} failed: ${(err as Error).message}`,
        );
      }
    }
  }
  return persisted;
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
      console.info(
        `[resolver] ${providerId} returned ${evs.length} events. Catalog: "${match.home.name}" vs "${match.away.name}"`,
      );
      if (evs.length > 0) {
        const sample = evs.slice(0, 5).map((e) => `"${e.homeName}" vs "${e.awayName}"`);
        console.info(`[resolver] sample events: ${sample.join(" | ")}`);
      }
      return evs.map((e) => ({
        eventId: e.eventId,
        homeName: e.homeName,
        awayName: e.awayName,
        kickoffAt: e.kickoffAt,
      }));
    },
  });
  const result = await resolver.resolve(match);
  const pct = Math.round(result.confidence * 100);
  if (result.matched) {
    console.info(
      `[resolver] matched "${result.matched.homeName}" vs "${result.matched.awayName}" (${pct}%)`,
    );
  } else {
    console.warn(`[resolver] NO match for "${match.home.name}" vs "${match.away.name}" (best ${pct}%)`);
  }
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
    allCandidates: [],
    combos: [],
    lines: {},
    openers: {},
    synthetic: {},
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

      await persistSnapshots(matchId, snapshots, false).catch(() => {});
      const realOpeners = await backfillOpeners(
        matchId,
        snapshots,
        oddsProvider,
        parentSignal,
      ).catch(() => 0);
      if (realOpeners === 0) {
        await persistSnapshots(matchId, snapshots, true).catch(() => {});
      }
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

  const synthetic: Partial<Record<MarketKey, SyntheticPrice[]>> = {};
  try {
    const ouSynth = computeSyntheticOU(lines.OU_GOALS);
    if (ouSynth.length > 0) synthetic.OU_GOALS = ouSynth;
    const ahSynth = computeSyntheticAH(lines.OU_GOALS, lines.AH, lines.ML_1X2);
    if (ahSynth.length > 0) synthetic.AH = ahSynth;
  } catch (err) {
    console.warn("[useAnalysis] synthetic line generation failed", err);
  }

  // Inject synthetic OU + AH lines into the engine pipeline so xG-based rules
  // can emit picks on lines the book does not offer. Reasoning: λ in xG rules
  // is derived from team xG (independent of market), so comparing modelP vs
  // synthetic-derived baseProb gives a real signal — not circular. We only
  // add lines NOT present in real offers, marked with book="synthetic-poisson"
  // so the user can see the source in the trace.
  if (synthetic.OU_GOALS && synthetic.OU_GOALS.length > 0) {
    const merged = mergeSyntheticIntoLines(
      "OU_GOALS",
      lines.OU_GOALS,
      synthetic.OU_GOALS,
      matchId,
      generatedAt,
    );
    if (merged) lines.OU_GOALS = merged;
  }
  if (synthetic.AH && synthetic.AH.length > 0) {
    const merged = mergeSyntheticIntoLines(
      "AH",
      lines.AH,
      synthetic.AH,
      matchId,
      generatedAt,
    );
    if (merged) lines.AH = merged;
  }

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

  const { candidates: allCandidates, combos, diagnostics } = runBondedAnalysis(ctx, {
    includePass: true,
  });
  const plays = allCandidates.filter((c) => c.verdict !== "PASS");
  return {
    plays,
    allCandidates,
    combos,
    diagnostics,
    lines,
    openers,
    synthetic,
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
