// Tennis analysis orchestration — Match Winner (ML_TENNIS), Total Games (OU_GAMES),
// and Games Handicap (AH_GAMES). Mirrors baseball/analyze.ts structure: baseEmpty,
// withTimeout, graceful degradation, de-vig Bet365 two-way for display edge,
// PlayCandidate emission, EV/confidence gating, FLAT 1u staking, CLV snapshots.
// No Pinnacle on plan → the Markov model is the fair line; Bet365 two-way
// de-vigged only for the displayed "edge vs book", not as a pricing anchor.
// Books: Bet365 (bet target) + DraftKings (secondary price check).

import { BookId, MatchId, PlayId } from "@/domain/ids";
import type { EloRatings, MatchFormat, PlayerServeStats, Surface, Tour } from "@/domain/tennis";
import { defaultMatchFormat } from "@/domain/tennis";
import type { ReasoningEntry } from "@/domain/trace";
import type { PlayCandidate, Verdict } from "@/domain/play";
import type { StakePolicy } from "@/domain/strategy";
import type { AnalysisDiagnostics } from "@/engine";
import { DEFAULT_UNIT_BANKROLL_FRACTION } from "@/engine";
import { sizeStakeUnits } from "@/engine/stake";
import { settingsStore } from "@/services/settings/settingsStore";
import { snapshotsRepo } from "@/storage/repos/snapshotsRepo";
import { isPersistentStorage } from "@/storage";
import { loadStrategy } from "@/features/match-detail/hooks/loadStrategy";
import type { AnalysisResult, AnalyzeArgs, ResolutionInfo } from "@/sports/contracts";
// Model types and projection function (model-coder writes model/index.ts + model/projection.ts).
// ServeParams + MatchProjection defined in model/types.ts (already exists).
import type { MatchProjection, ScoreDistribution } from "./model/types";
import { projectMatch } from "./model";
// Data fetchers (data-coder). Each degrades gracefully on failure.
import {
  fetchSackmannData,
  getPlayerElo,
  getPlayerServeStats,
  type SackmannData,
} from "./sackmannData";
import { fetchTennisProps, type TennisMatchOdds } from "./oddsProps";
import { TENNIS_SOURCE } from "./providers";
// EV/confidence thresholds are the single source of truth in model/constants.ts.
import {
  EV_THRESHOLD,
  STRONG_EV_THRESHOLD,
  MIN_CONFIDENCE,
} from "./model/constants";

export const TENNIS_ODDS_SLUG = "tennis";

// Bet365 = bet target (we bet into it); DraftKings = secondary price check.
// Hardcoded — same reasoning as baseball's BASEBALL_PROP_BOOKS (independent of
// the global userBooks list, which drives football team-market odds).
export const TENNIS_BOOKS = ["Bet365", "DraftKings"];
export const TENNIS_BET_BOOK = "Bet365";

const LEG_TIMEOUT_MS = 30_000;

// FLAT 1u until the Markov model has a CLV track record. sizeStakeUnits is
// already polymorphic on policy.kind; to switch to ¼-Kelly later, flip `kind`
// and nothing in analyze() itself changes.
const FLAT_TENNIS_POLICY: StakePolicy = {
  kind: "FLAT",
  kellyFraction: 0.25,
  maxUnitsPerPlay: 2,
  flatUnits: 1,
  minEdgePct: EV_THRESHOLD,
  minConfidence: MIN_CONFIDENCE,
  unbondedFactor: 1,
};

// Copied verbatim from baseball/analyze.ts — keeps both modules independent.
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

// ── Surface / format helpers ────────────────────────────────────────────────

// Tour from league name: "ATP …" → "atp", "WTA …" → "wta". Default "atp".
const deriveTour = (leagueName: string): Tour =>
  /wta/i.test(leagueName) ? "wta" : "atp";

// Surface from tournament name. Hard is the default; named clay/grass events
// are the minority but material for the Markov model's shrinkage pass.
const deriveSurface = (leagueName: string): Surface => {
  const up = leagueName.toUpperCase();
  if (/CLAY|ROLAND.GARROS|MONTE.CARLO|MADRID|ROME|HAMBURG|BARCELONA/.test(up))
    return "clay";
  if (/GRASS|WIMBLEDON|QUEENS|HALLE|EASTBOURNE|MALLORCA|HERTOGENBOSCH/.test(up))
    return "grass";
  return "hard";
};

// MatchFormat from tour + event name. ATP Grand Slams → BO5 advantage/tiebreak;
// all other events → BO3 standard tiebreak. Uses defaultMatchFormat from domain.
const deriveFormat = (tour: Tour, leagueName: string): MatchFormat => {
  const up = leagueName.toUpperCase();
  const isGrandSlam =
    /AUSTRALIAN|ROLAND.GARROS|WIMBLEDON|US OPEN|GRAND SLAM/.test(up);
  const isWimbledon = /WIMBLEDON/.test(up);
  return defaultMatchFormat(tour, { grandSlam: isGrandSlam, wimbledon: isWimbledon });
};

// ── Games distribution helpers ───────────────────────────────────────────────

// Both helpers walk the gamesDistribution map (keys = "gamesA-gamesB" over the
// full match; absent = not yet output by the model — markets are silently skipped).

// P(totalGames > line) — over market.
const pOverGames = (dist: ScoreDistribution, line: number): number => {
  let acc = 0;
  for (const [key, p] of Object.entries(dist)) {
    const dash = key.indexOf("-");
    if (dash < 0) continue;
    const a = Number(key.slice(0, dash));
    const b = Number(key.slice(dash + 1));
    if (!Number.isNaN(a) && !Number.isNaN(b) && a + b > line) acc += p;
  }
  return Math.min(1, acc);
};

// P(gamesA − gamesB + handicap > 0) — games handicap; handicap < 0 means A
// gives games, handicap > 0 means A receives games (standard AH convention).
const pCoverGames = (dist: ScoreDistribution, handicap: number): number => {
  let acc = 0;
  for (const [key, p] of Object.entries(dist)) {
    const dash = key.indexOf("-");
    if (dash < 0) continue;
    const a = Number(key.slice(0, dash));
    const b = Number(key.slice(dash + 1));
    if (!Number.isNaN(a) && !Number.isNaN(b) && a - b + handicap > 0) acc += p;
  }
  return Math.min(1, Math.max(0, acc));
};

// ── De-vig helper ────────────────────────────────────────────────────────────

// De-vig the Bet365 two-way offer purely for the displayed "edge vs book" —
// with no Pinnacle on plan the model is the fair prob, not the sharp line.
// Returns [0, 0] when either decimal is absent or ≤ 1 (bad data); caller
// gates emission on fairHome > 0.
const deVigTwoWay = (
  homeDec: number | undefined,
  awayDec: number | undefined,
): [fairHome: number, fairAway: number] => {
  if (!homeDec || !awayDec || homeDec <= 1 || awayDec <= 1) return [0, 0];
  const impHome = 1 / homeDec;
  const impAway = 1 / awayDec;
  const denom = impHome + impAway;
  return denom > 0 ? [impHome / denom, impAway / denom] : [0, 0];
};

// ── Main export ──────────────────────────────────────────────────────────────

export const analyzeTennis = async (args: AnalyzeArgs): Promise<AnalysisResult> => {
  const { match, signal: parentSignal } = args;
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

  // Tennis fixtures ARE odds-api.io events (data-coder sets source = "odds-api-io"
  // in providers.ts). catalogId is the event id — trivial resolution, unlike
  // baseball where statsapi provides the gamePk as catalogId.
  if (match.source !== TENNIS_SOURCE) {
    return {
      ...baseEmpty(),
      status: "error",
      message: "Not an odds-api.io tennis fixture",
    };
  }
  const oddsEventId = match.catalogId;

  const settings = await settingsStore.load();
  if (!settings.oddsApiIoKey) return { ...baseEmpty(), status: "no-api-key" };
  const apiKey = settings.oddsApiIoKey;

  const resInfo: ResolutionInfo = {
    oddsProviderId: "odds-api-io",
    oddsEventId,
    // Confidence = 1 because catalogId IS the event id — no fuzzy match needed.
    confidence: 1,
    resolvedAt: generatedAt,
  };

  const surface = deriveSurface(match.leagueName);
  const tour = deriveTour(match.leagueName);
  const format = deriveFormat(tour, match.leagueName);

  // Parallel: whole-tour Sackmann data (Elo + serve stats, 24h cached) and the
  // Bet365/DK odds for this event. One Sackmann fetch covers both players.
  const [sack, matchOdds] = await Promise.all([
    withTimeout(
      (s) => fetchSackmannData(tour, s),
      LEG_TIMEOUT_MS,
      undefined as SackmannData | undefined,
      parentSignal,
    ),
    withTimeout(
      (s) => fetchTennisProps({ eventId: oddsEventId, apiKey, books: TENNIS_BOOKS, signal: s }),
      LEG_TIMEOUT_MS,
      {} as TennisMatchOdds,
      parentSignal,
    ),
  ]);

  // Per-player lookups (null when the Sackmann fetch failed or the player is
  // absent from the dataset, e.g. an unranked Challenger/ITF entrant).
  const aServe = sack ? getPlayerServeStats(match.home.name, sack) : null;
  const aElo = sack ? getPlayerElo(match.home.name, sack) : null;
  const bServe = sack ? getPlayerServeStats(match.away.name, sack) : null;
  const bElo = sack ? getPlayerElo(match.away.name, sack) : null;
  // Diagnostics availability flags (1/0).
  const p1Data = aServe || aElo ? 1 : 0;
  const p2Data = bServe || bElo ? 1 : 0;

  // Flatten TennisMatchOdds into the two-way decimals the market sections read.
  const oddsProps = {
    mlHomeDecimal: matchOdds.mlA,
    mlAwayDecimal: matchOdds.mlB,
    totalLine: matchOdds.totalGames?.line,
    totalOverDecimal: matchOdds.totalGames?.overDec,
    totalUnderDecimal: matchOdds.totalGames?.underDec,
    spreadLine: matchOdds.gameSpread?.hdp,
    spreadHomeDecimal: matchOdds.gameSpread?.aDec,
    spreadAwayDecimal: matchOdds.gameSpread?.bDec,
  };

  // Assemble TennisPlayer objects. elo and serveStats may be absent when the
  // Sackmann fetch failed or the player is unranked — the model degrades to
  // league-average serve params and lowers confidence accordingly.
  const playerA = {
    playerId: `tennis:${match.home.name}`,
    name: match.home.name,
    tour,
    elo: aElo ?? undefined,
    serveStats: aServe ?? undefined,
  };
  const playerB = {
    playerId: `tennis:${match.away.name}`,
    name: match.away.name,
    tour,
    elo: bElo ?? undefined,
    serveStats: bServe ?? undefined,
  };

  // Run the Markov point-level match model. Never throws — the model is pure.
  const proj: MatchProjection = projectMatch({ playerA, playerB, surface, format });

  // Confidence floor — too little data to price any market reliably.
  if (proj.confidence < MIN_CONFIDENCE) {
    const diagnostics: AnalysisDiagnostics = {
      selectionsEnumerated: 0,
      selectionsSkipped: { noPrice: 0, noBaseProb: 0 },
      verdictBreakdown: { PASS: 0, LEAN: 0, PLAY: 0, STRONG: 0 },
      rulesFired: {
        lowConfidence: 1,
        p1DataAvailable: p1Data ? 1 : 0,
        p2DataAvailable: p2Data ? 1 : 0,
        candidates: 0,
        plays: 0,
      },
      rulesSkippedDataMissing: {},
      dataMissing: {
        homeForm: true, awayForm: true, homeXG: true, awayXG: true,
        splitsMissing: [], openersMissing: [], h2hMeetings: 0, intangibles: true,
      },
    };
    return { ...baseEmpty(), diagnostics, status: "ok", resolution: resInfo };
  }

  // ── Market evaluation ──────────────────────────────────────────────────────

  const allCandidates: PlayCandidate[] = [];

  // Build one PlayCandidate and push it to allCandidates. Pure (no throws).
  const emit = (args: {
    marketKey: "ML_TENNIS" | "OU_GAMES" | "AH_GAMES";
    side: string;
    dec: number;
    fairProb: number;
    bookFairProb: number;
    ev: number;
    line?: number;
    traceMsg: string;
  }): void => {
    const { marketKey, side, dec, fairProb, bookFairProb, ev, line, traceMsg } = args;
    const passes = ev >= EV_THRESHOLD;
    const verdict: Verdict = !passes ? "PASS" : ev >= STRONG_EV_THRESHOLD ? "PLAY" : "LEAN";
    const trace: ReasoningEntry[] = [
      {
        source: "math",
        id: `tennis-${marketKey.toLowerCase()}-${side}`,
        verdict: ev > 0 ? "SUPPORT" : "AGAINST",
        weight: proj.confidence,
        message: traceMsg,
        data: {
          fairProb,
          bookFairProb,
          ev,
          line,
          confidence: proj.confidence,
          tier: proj.tier,
          spwA: proj.inputsUsed.spwA,
          spwB: proj.inputsUsed.spwB,
          eloAvailable: proj.inputsUsed.eloAvailable,
        },
      },
    ];
    const lineTag = line !== undefined ? `@${line}` : "";
    allCandidates.push({
      id: PlayId(`${oddsEventId}:${marketKey}:${side}${lineTag}`),
      matchId: MatchId(oddsEventId),
      selection: { marketKey, side, line },
      price: { decimal: dec, book: BookId(TENNIS_BET_BOOK), takenAt: generatedAt },
      edgePct: ev,
      fairProb,
      confidence: proj.confidence,
      stakeUnits: passes
        ? sizeStakeUnits({
            policy: FLAT_TENNIS_POLICY,
            fairProb,
            priceDecimal: dec,
            confidence: proj.confidence,
            unitBankrollFraction: DEFAULT_UNIT_BANKROLL_FRACTION,
          })
        : 0,
      verdict,
      trace,
      generatedAt,
    });
  };

  // ML_TENNIS — Match Winner (two-way, no draw).
  // Model: pMatchWin = P(player A / home wins). De-vig Bet365 two-way purely
  // for the displayed edge; the model fair prob is the pricing anchor.
  if (oddsProps.mlHomeDecimal && oddsProps.mlAwayDecimal) {
    const [bkHome, bkAway] = deVigTwoWay(oddsProps.mlHomeDecimal, oddsProps.mlAwayDecimal);
    if (bkHome > 0) {
      const pHome = proj.pMatchWin;
      const pAway = 1 - pHome;
      emit({
        marketKey: "ML_TENNIS", side: "home",
        dec: oddsProps.mlHomeDecimal, fairProb: pHome, bookFairProb: bkHome,
        ev: pHome * oddsProps.mlHomeDecimal - 1,
        traceMsg:
          `${match.home.name} ML — model P(win)=${(pHome * 100).toFixed(1)}% ` +
          `vs book ${(bkHome * 100).toFixed(1)}%, ` +
          `EV ${((pHome * oddsProps.mlHomeDecimal - 1) * 100).toFixed(1)}%`,
      });
      emit({
        marketKey: "ML_TENNIS", side: "away",
        dec: oddsProps.mlAwayDecimal, fairProb: pAway, bookFairProb: bkAway,
        ev: pAway * oddsProps.mlAwayDecimal - 1,
        traceMsg:
          `${match.away.name} ML — model P(win)=${(pAway * 100).toFixed(1)}% ` +
          `vs book ${(bkAway * 100).toFixed(1)}%, ` +
          `EV ${((pAway * oddsProps.mlAwayDecimal - 1) * 100).toFixed(1)}%`,
      });
    }
  }

  // OU_GAMES — Total games in match. gamesDistribution is optional in v1 (the
  // model can produce it as a "gamesA-gamesB" sparse map; absent → market skipped).
  if (proj.gamesDistribution && oddsProps.totalLine !== undefined
      && oddsProps.totalOverDecimal && oddsProps.totalUnderDecimal) {
    const line = oddsProps.totalLine;
    const pOver = pOverGames(proj.gamesDistribution, line);
    const pUnder = 1 - pOver;
    const [bkOver, bkUnder] = deVigTwoWay(oddsProps.totalOverDecimal, oddsProps.totalUnderDecimal);
    if (bkOver > 0) {
      emit({
        marketKey: "OU_GAMES", side: "over",
        dec: oddsProps.totalOverDecimal, fairProb: pOver, bookFairProb: bkOver,
        ev: pOver * oddsProps.totalOverDecimal - 1, line,
        traceMsg:
          `Total games O${line} — model P(over)=${(pOver * 100).toFixed(1)}% ` +
          `vs book ${(bkOver * 100).toFixed(1)}%, ` +
          `EV ${((pOver * oddsProps.totalOverDecimal - 1) * 100).toFixed(1)}%`,
      });
      emit({
        marketKey: "OU_GAMES", side: "under",
        dec: oddsProps.totalUnderDecimal, fairProb: pUnder, bookFairProb: bkUnder,
        ev: pUnder * oddsProps.totalUnderDecimal - 1, line,
        traceMsg:
          `Total games U${line} — model P(under)=${(pUnder * 100).toFixed(1)}% ` +
          `vs book ${(bkUnder * 100).toFixed(1)}%, ` +
          `EV ${((pUnder * oddsProps.totalUnderDecimal - 1) * 100).toFixed(1)}%`,
      });
    }
  }

  // AH_GAMES — Games handicap (Asian handicap on game count).
  // spreadLine < 0 → home/A gives games; > 0 → home/A receives games.
  // Same guard as totals: needs gamesDistribution from the model.
  if (proj.gamesDistribution && oddsProps.spreadLine !== undefined
      && oddsProps.spreadHomeDecimal && oddsProps.spreadAwayDecimal) {
    const hcap = oddsProps.spreadLine;
    const pHome = pCoverGames(proj.gamesDistribution, hcap);
    const pAway = 1 - pHome;
    const [bkHome, bkAway] = deVigTwoWay(oddsProps.spreadHomeDecimal, oddsProps.spreadAwayDecimal);
    if (bkHome > 0) {
      const sign = (n: number) => (n > 0 ? "+" : "");
      emit({
        marketKey: "AH_GAMES", side: "home",
        dec: oddsProps.spreadHomeDecimal, fairProb: pHome, bookFairProb: bkHome,
        ev: pHome * oddsProps.spreadHomeDecimal - 1, line: hcap,
        traceMsg:
          `${match.home.name} AH(${sign(hcap)}${hcap} games) — ` +
          `model P(cover)=${(pHome * 100).toFixed(1)}% ` +
          `vs book ${(bkHome * 100).toFixed(1)}%, ` +
          `EV ${((pHome * oddsProps.spreadHomeDecimal - 1) * 100).toFixed(1)}%`,
      });
      emit({
        marketKey: "AH_GAMES", side: "away",
        dec: oddsProps.spreadAwayDecimal, fairProb: pAway, bookFairProb: bkAway,
        ev: pAway * oddsProps.spreadAwayDecimal - 1, line: -hcap,
        traceMsg:
          `${match.away.name} AH(${sign(-hcap)}${-hcap} games) — ` +
          `model P(cover)=${(pAway * 100).toFixed(1)}% ` +
          `vs book ${(bkAway * 100).toFixed(1)}%, ` +
          `EV ${((pAway * oddsProps.spreadAwayDecimal - 1) * 100).toFixed(1)}%`,
      });
    }
  }

  const plays = allCandidates.filter((c) => c.verdict !== "PASS");

  // Persist Bet365 offers for CLV (closing-line value) tracking. Best-effort —
  // snapshot failure must never break analysis. Record every candidate incl. PASS
  // (a near-miss line may still be bet manually; rows are cheap).
  if (isPersistentStorage() && allCandidates.length > 0) {
    try {
      await Promise.all(
        allCandidates.map((c) =>
          snapshotsRepo.recordOffer({
            matchId: MatchId(oddsEventId),
            marketKey: c.selection.marketKey,
            selection: c.selection,
            priceDecimal: c.price.decimal,
            book: BookId(TENNIS_BET_BOOK),
            takenAt: generatedAt,
            isOpener: false,
          }),
        ),
      );
    } catch {
      /* snapshot persistence is best-effort; CLV stays pending on failure */
    }
  }

  const diagnostics: AnalysisDiagnostics = {
    selectionsEnumerated: allCandidates.length,
    selectionsSkipped: { noPrice: 0, noBaseProb: 0 },
    verdictBreakdown: { PASS: 0, LEAN: 0, PLAY: 0, STRONG: 0 },
    rulesFired: {
      p1DataAvailable: p1Data ? 1 : 0,
      p2DataAvailable: p2Data ? 1 : 0,
      gamesDistributionPresent: proj.gamesDistribution ? 1 : 0,
      candidates: allCandidates.length,
      plays: plays.length,
    },
    rulesSkippedDataMissing: {},
    dataMissing: {
      homeForm: true,
      awayForm: true,
      homeXG: true,
      awayXG: true,
      splitsMissing: [],
      openersMissing: [],
      h2hMeetings: 0,
      intangibles: true,
    },
  };
  for (const c of allCandidates) diagnostics.verdictBreakdown[c.verdict]++;

  return {
    ...baseEmpty(),
    plays,
    allCandidates,
    diagnostics,
    status: "ok",
    resolution: resInfo,
  };
};
