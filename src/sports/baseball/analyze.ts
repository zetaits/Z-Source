// Baseball analysis orchestration — pitcher strikeout (K) props. Mirrors the
// STRUCTURE of football/analyze.ts (baseEmpty, Promise.all legs, withTimeout,
// status union) but the body is K-props, not the bonded engine. Wires the
// Phase-1 statsapi/Savant fetchers and the Phase-2 projectStrikeouts model:
// resolve the odds-api.io MLB event, fetch props + pitcher/lineup data,
// project each probable's K distribution, compare model fair prob vs the book
// line, and emit PlayCandidates. Every fetch degrades gracefully — missing
// data yields fewer/zero plays, never an error.

import { BookId, MatchId, PlayId } from "@/domain/ids";
import type { BatterKSplits, Handedness, LineupSlot } from "@/domain/baseball";
import type { ReasoningEntry } from "@/domain/trace";
import type { PlayCandidate, Verdict } from "@/domain/play";
import type { StakePolicy } from "@/domain/strategy";
import type { AnalysisDiagnostics } from "@/engine";
import { DEFAULT_UNIT_BANKROLL_FRACTION } from "@/engine";
import { sizeStakeUnits } from "@/engine/stake";
import { resolveProviders } from "@/services/providers/factory";
import { createMatchResolver } from "@/services/resolver/MatchResolver";
import { jaroWinkler } from "@/services/resolver/teamNameNormalizer";
import { settingsStore } from "@/services/settings/settingsStore";
import { snapshotsRepo } from "@/storage/repos/snapshotsRepo";
import { isPersistentStorage } from "@/storage";
import { loadStrategy } from "@/features/match-detail/hooks/loadStrategy";
import type { AnalysisResult, AnalyzeArgs, ResolutionInfo } from "@/sports/contracts";
import {
  getScheduleGame,
  getLineup,
  getPitcherSeasonStats,
  getPitcherGameLogs,
  getPlayerHands,
  getBatterKSplits,
} from "./statsapiData";
import { getPitcherSavant } from "./savantData";
import { projectStrikeouts } from "./model";
import {
  fetchPitcherProps,
  normalizeName,
  type EventPitcherProps,
  type PitcherProps,
} from "./oddsProps";

export const BASEBALL_ODDS_SLUG = "baseball";

// Pitcher-prop books, hardcoded (personal app): Bet365 is the bet target and the
// ksBook (Ks lines come from it); DraftKings adds an "Outs Recorded" line that
// co-anchors batters-faced. Both must be among the odds-api.io account's allowed
// bookmakers. Decoupled from the configurable userBooks (football/team markets).
export const BASEBALL_PROP_BOOKS = ["Bet365", "DraftKings"];
export const BASEBALL_KS_BOOK = "Bet365";

/**
 * Is a Ks side bettable? Requires BOTH a positive EV over threshold AND a market
 * Pitcher Outs O/U anchor for batters-faced. The anchor requirement is empirical
 * (n=37 audit, 2026-06-27): unanchored picks went 2/14 (−75% ROI) vs anchored
 * 13/23 (+11%). Pure so it's unit-tested; analyze() gates the verdict on it.
 */
export const isBettableKs = (
  ev: number,
  lengthAnchored: boolean,
  evThreshold: number,
): boolean => ev >= evThreshold && lengthAnchored;

const MLB_LEAGUE_NAME = "USA - MLB";
const EV_THRESHOLD = 0.05; // 5% min EV to emit a play (conservative v1)
const STRONG_EV_THRESHOLD = 0.1; // PLAY when EV >= this, else LEAN
const MIN_CONFIDENCE = 0.45; // model confidence floor
const LEG_TIMEOUT_MS = 35_000;
const GAMELOG_N = 10;
const NAME_FUZZY_FLOOR = 0.85;

// v1 staking is FLAT and pinned here, independent of the DB strategy default
// (which is FRACTIONAL_KELLY) — until CLV validates the K-model, uniform 1u
// keeps the beat-close sample clean of sizing variance. To switch to ¼-Kelly
// once enough plays are logged, flip `kind` to "FRACTIONAL_KELLY" (or pass
// `strategy.stakePolicy` straight through): sizeStakeUnits is already
// polymorphic on policy.kind, so analyze() itself never changes.
const FLAT_BASEBALL_POLICY: StakePolicy = {
  kind: "FLAT",
  kellyFraction: 0.25,
  maxUnitsPerPlay: 2,
  flatUnits: 1,
  minEdgePct: EV_THRESHOLD,
  minConfidence: MIN_CONFIDENCE,
  unbondedFactor: 1,
};

const currentSeason = () => new Date().getFullYear();

// Copied verbatim from football/analyze.ts so football stays untouched.
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

// Exact-key lookup, then a fuzzy fallback over the prop map keys using the same
// name-similarity floor (statsapi "Rhett Lowder" vs book "R. Lowder").
const lookupProps = (
  eventProps: EventPitcherProps,
  pitcherName: string,
): PitcherProps | undefined => {
  const key = normalizeName(pitcherName);
  const exact = eventProps.get(key);
  if (exact) return exact;
  let best: { props: PitcherProps; score: number } | null = null;
  for (const [propKey, props] of eventProps) {
    const score = jaroWinkler(key, propKey);
    if (!best || score > best.score) best = { props, score };
  }
  return best && best.score >= NAME_FUZZY_FLOOR ? best.props : undefined;
};

interface ProbableWork {
  name: string;
  playerId: number;
  teamSide: "home" | "away";
}

interface PitcherPlays {
  candidates: PlayCandidate[];
  projected: boolean;
  propsMatched: boolean;
}

// Project one probable pitcher's K distribution and emit over/under candidates
// per book Ks line. Sub-threshold sides become PASS candidates (near-miss rail).
const analyzePitcher = async (args: {
  probable: ProbableWork;
  oppLineupRaw: LineupSlot[];
  season: number;
  oddsEventId: string;
  gamePk: number;
  date: string;
  eventProps: EventPitcherProps;
  generatedAt: string;
  stakePolicy: StakePolicy;
  signal?: AbortSignal;
}): Promise<PitcherPlays> => {
  const { probable, oppLineupRaw, season, oddsEventId, gamePk, date, eventProps, generatedAt, stakePolicy, signal } = args;
  const empty: PitcherPlays = { candidates: [], projected: false, propsMatched: false };

  const pitcher = await withTimeout(
    (s) => getPitcherSeasonStats(probable.playerId, season, s),
    LEG_TIMEOUT_MS,
    undefined,
    signal,
  );
  if (!pitcher) return empty; // can't project without season stats

  const [gamelogs, savant, pitcherHands] = await Promise.all([
    withTimeout((s) => getPitcherGameLogs(probable.playerId, GAMELOG_N, season, s), LEG_TIMEOUT_MS, [], signal),
    withTimeout((s) => getPitcherSavant(probable.playerId, season, s), LEG_TIMEOUT_MS, undefined, signal),
    withTimeout((s) => getPlayerHands([probable.playerId], s), LEG_TIMEOUT_MS, new Map(), signal),
  ]);
  // ProbablePitcher has no throws; resolve via /people. Default "R" (most
  // common) — the model already penalises confidence via the no-data paths.
  const throws: Handedness = pitcherHands.get(probable.playerId)?.throws ?? "R";

  // Opponent batter hands + K-splits. Build LineupSlot[] WITH `bats` populated.
  const oppIds = oppLineupRaw.map((s) => s.playerId);
  const hands = oppIds.length > 0
    ? await withTimeout((s) => getPlayerHands(oppIds, s), LEG_TIMEOUT_MS, new Map(), signal)
    : new Map();
  const oppLineup: LineupSlot[] = oppLineupRaw.map((s) => ({
    ...s,
    bats: hands.get(s.playerId)?.bats,
  }));
  const batterSplits: Record<number, BatterKSplits> = {};
  await Promise.all(
    oppIds.map(async (id) => {
      const split = await withTimeout(
        (s) => getBatterKSplits(id, season, s),
        LEG_TIMEOUT_MS,
        undefined,
        signal,
      );
      if (split) batterSplits[id] = split;
    }),
  );

  const props = lookupProps(eventProps, probable.name);

  const proj = projectStrikeouts({
    pitcher,
    throws,
    gamelogs,
    savant,
    opponentLineup: oppLineup,
    batterSplits,
    marketOutsLine: props?.outsLine,
  });

  // Confidence floor — too little data to bet on.
  if (proj.confidence < MIN_CONFIDENCE) {
    return { candidates: [], projected: true, propsMatched: Boolean(props) };
  }
  if (!props || props.ksLines.length === 0) {
    return { candidates: [], projected: true, propsMatched: false };
  }

  const candidates: PlayCandidate[] = [];
  for (const ks of props.ksLines) {
    const pOver = proj.pOver(ks.line);
    const pUnder = 1 - pOver;
    // De-vig the Bet365 two-way purely for the displayed "edge vs book" — there
    // is no sharp prop line to anchor, so THE MODEL is the fair prob.
    const impOver = 1 / ks.overDec;
    const impUnder = 1 / ks.underDec;
    const denom = impOver + impUnder;
    const bookOverFair = denom > 0 ? impOver / denom : 0;
    const evOver = pOver * ks.overDec - 1;
    const evUnder = pUnder * ks.underDec - 1;

    const mkPlay = (
      side: "over" | "under",
      dec: number,
      fair: number,
      ev: number,
      bookFair: number,
    ): PlayCandidate => {
      // Length gate (empirical, n=37 audit 2026-06-27): the model only beats the
      // book when a Pitcher Outs O/U line anchors batters-faced. Picks WITHOUT it
      // (BF estimated from recent starts) went 2/14 (−75% ROI) vs 13/23 (+11%)
      // WITH it — and the book withholding an Outs line is itself a signal the
      // outing length is unpredictable. So an Outs-line anchor is REQUIRED to
      // bet; unanchored selections stay PASS (near-miss rail) regardless of EV.
      // This supersedes the model's softer bfAnchored (which accepts recent
      // starts) for the betting decision only — the projection is unchanged.
      const lengthAnchored = proj.inputsUsed.usedMarketOutsLine;
      const passes = isBettableKs(ev, lengthAnchored, EV_THRESHOLD);
      const verdict: Verdict = !passes
        ? "PASS"
        : ev >= STRONG_EV_THRESHOLD
          ? "PLAY"
          : "LEAN";
      const trace: ReasoningEntry[] = [
        {
          source: "math",
          id: "k-projection",
          verdict: ev > 0 ? "SUPPORT" : "AGAINST",
          weight: proj.confidence,
          message:
            `${probable.name} ${side} ${ks.line} K — model E[K]=${proj.expectedKs.toFixed(2)}, ` +
            `fair ${(fair * 100).toFixed(1)}% vs book ${(bookFair * 100).toFixed(1)}%, EV ${(ev * 100).toFixed(1)}%`,
          data: {
            expectedKs: proj.expectedKs,
            tier: proj.inputsUsed.tier,
            savantSource: proj.inputsUsed.savantSource,
            lineupConfirmed: proj.inputsUsed.lineupConfirmed,
            bfMean: proj.inputsUsed.bfMean,
            usedMarketOutsLine: proj.inputsUsed.usedMarketOutsLine,
            lengthAnchored: proj.inputsUsed.usedMarketOutsLine,
            modelFairProb: fair,
            bookOverFair: bookFair,
            ev,
            line: ks.line,
          },
        },
      ];
      return {
        id: PlayId(`${oddsEventId}:PITCHER_KS:${side}@${ks.line}|${normalizeName(probable.name)}`),
        matchId: MatchId(oddsEventId),
        selection: {
          marketKey: "PITCHER_KS",
          side,
          line: ks.line,
          player: probable.name,
          propLabel: "Strikeouts O/U",
        },
        price: { decimal: dec, book: BookId("Bet365"), takenAt: generatedAt },
        // Native statsapi ids so the autopilot can auto-settle from the box score
        // (matchId is the odds-api event id, which can't address the box score).
        settleRef: { gamePk, playerId: probable.playerId, date },
        // Fraction (e.g. 0.05), matching football's PlayCandidate.edgePct — the
        // UI (formatPct, EnginePlayground) multiplies by 100. Do NOT pre-scale.
        edgePct: ev,
        fairProb: fair,
        confidence: proj.confidence,
        // Stake via the shared stake-policy seam (engine/stake.ts). v1 pins a
        // FLAT policy; PASS candidates (near-misses) get 0u. Swapping to
        // ¼-Kelly later is a policy flip, not an analyze() change.
        stakeUnits: passes
          ? sizeStakeUnits({
              policy: stakePolicy,
              fairProb: fair,
              priceDecimal: dec,
              confidence: proj.confidence,
              unitBankrollFraction: DEFAULT_UNIT_BANKROLL_FRACTION,
            })
          : 0,
        verdict,
        trace,
        generatedAt,
      };
    };

    candidates.push(mkPlay("over", ks.overDec, pOver, evOver, bookOverFair));
    candidates.push(mkPlay("under", ks.underDec, pUnder, evUnder, 1 - bookOverFair));
  }

  return { candidates, projected: true, propsMatched: true };
};

export const analyzeBaseball = async (args: AnalyzeArgs): Promise<AnalysisResult> => {
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

  // Only the statsapi fixtures feed carries a gamePk catalogId.
  if (match.source !== "mlb-statsapi") {
    return { ...baseEmpty(), status: "error", message: "Not an MLB statsapi fixture" };
  }
  const gamePk = Number(match.catalogId);
  const date = match.kickoffAt.slice(0, 10); // YYYY-MM-DD
  const season = currentSeason();

  const settings = await settingsStore.load();
  if (!settings.oddsApiIoKey) return { ...baseEmpty(), status: "no-api-key" };
  const apiKey = settings.oddsApiIoKey;
  // Pitcher props live only on Bet365 (the bet target → ksBook) and DraftKings
  // (a second "Outs Recorded" line, averaged into the BF anchor). Hardcoded —
  // independent of the global userBooks list (which drives team-market odds and
  // still carries the football books); these two are the only props sources and
  // must match the odds-api.io account's allowed bookmakers.
  const propBooks = BASEBALL_PROP_BOOKS;

  const { odds: oddsProvider } = resolveProviders(settings, BASEBALL_ODDS_SLUG);

  // Resolve the odds-api.io event, filtering to MLB. The {listEvents} adapter
  // ignores the {from,to} window, matching the football resolver shape.
  const resolver = createMatchResolver({
    listEvents: async () => {
      const evs = await oddsProvider.listEvents(BASEBALL_ODDS_SLUG);
      return evs
        .filter((e) => e.leagueName === MLB_LEAGUE_NAME)
        .map((e) => ({
          eventId: e.eventId,
          homeName: e.homeName,
          awayName: e.awayName,
          kickoffAt: e.kickoffAt,
        }));
    },
  });

  let resolution: { matchId: string | null; confidence: number };
  try {
    const result = await resolver.resolve(match);
    resolution = { matchId: result.matchId, confidence: result.confidence };
  } catch (err) {
    return { ...baseEmpty(), status: "error", message: (err as Error).message };
  }

  if (!resolution.matchId) {
    const pct = Math.round(resolution.confidence * 100);
    return {
      ...baseEmpty(),
      status: "unresolved",
      message: `No MLB odds event matched this fixture (best confidence ${pct}%).`,
    };
  }
  const oddsEventId = resolution.matchId;
  const resInfo: ResolutionInfo = {
    oddsProviderId: "odds-api-io",
    oddsEventId,
    confidence: resolution.confidence,
    resolvedAt: generatedAt,
  };

  // Parallel: props + probables/context + lineup.
  const [eventProps, schedule, lineup] = await Promise.all([
    withTimeout(
      (s) => fetchPitcherProps({ eventId: oddsEventId, apiKey, books: propBooks, ksBook: BASEBALL_KS_BOOK, signal: s }),
      LEG_TIMEOUT_MS,
      new Map() as EventPitcherProps,
      parentSignal,
    ),
    withTimeout((s) => getScheduleGame(gamePk, date, s), LEG_TIMEOUT_MS, undefined, parentSignal),
    withTimeout(
      (s) => getLineup(gamePk, date, s),
      LEG_TIMEOUT_MS,
      { gamePk, home: [], away: [], confirmed: false },
      parentSignal,
    ),
  ]);

  const probables = schedule?.probables ?? [];

  // Each pitcher faces the OTHER side's lineup.
  const pitcherResults = await Promise.all(
    probables.map((p) =>
      analyzePitcher({
        probable: { name: p.name, playerId: p.playerId, teamSide: p.teamSide },
        oppLineupRaw: p.teamSide === "home" ? lineup.away : lineup.home,
        season,
        oddsEventId,
        gamePk,
        date,
        eventProps,
        generatedAt,
        stakePolicy: FLAT_BASEBALL_POLICY,
        signal: parentSignal,
      }),
    ),
  );

  const allCandidates = pitcherResults.flatMap((r) => r.candidates);
  const plays = allCandidates.filter((c) => c.verdict !== "PASS");

  // Persist the Bet365 Ks offers so the bet-log's lazy closing-capture
  // (useSettleBet -> snapshotsRepo.latestFor) has a "closing" line to find when
  // the user settles a logged prop. "Closing" = the latest snapshot before
  // settle, so re-running analysis near first pitch tightens it. Record every
  // candidate incl. PASS — a near-miss line may still be bet manually, and the
  // rows are cheap. Guard on persistent storage (no-op on web/tests) and never
  // throw: a snapshot failure must not break analysis (graceful degradation —
  // missing snapshot just leaves CLV pending).
  if (isPersistentStorage() && allCandidates.length > 0) {
    try {
      await Promise.all(
        allCandidates.map((c) =>
          snapshotsRepo.recordOffer({
            matchId: MatchId(oddsEventId),
            marketKey: "PITCHER_KS",
            selection: c.selection,
            priceDecimal: c.price.decimal,
            book: BookId("Bet365"),
            takenAt: generatedAt,
            isOpener: false,
          }),
        ),
      );
    } catch {
      /* snapshot persistence is best-effort; CLV simply stays pending */
    }
  }

  const diagnostics: AnalysisDiagnostics = {
    selectionsEnumerated: allCandidates.length,
    selectionsSkipped: { noPrice: 0, noBaseProb: 0 },
    verdictBreakdown: { PASS: 0, LEAN: 0, PLAY: 0, STRONG: 0 },
    rulesFired: {
      pitchersProjected: pitcherResults.filter((r) => r.projected).length,
      propsMatched: pitcherResults.filter((r) => r.propsMatched).length,
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

  // Zero candidates with a clean resolution is a legitimate "no edge" — status ok.
  return {
    ...baseEmpty(),
    plays,
    allCandidates,
    diagnostics,
    status: "ok",
    resolution: resInfo,
  };
};
