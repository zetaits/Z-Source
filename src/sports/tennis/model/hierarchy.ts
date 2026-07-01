/**
 * Point-based hierarchical tennis model — the mathematical core.
 *
 * Everything on the board is derived analytically from two numbers: each
 * player's per-point serve-win probability (spwA, spwB). From those we build,
 * in closed form + small exact DPs:
 *   game hold prob -> tiebreak prob -> per-set game-score distribution ->
 *   match win prob + total-games + set-score distributions.
 *
 * Pure and deterministic — no I/O, no Date, no randomness. Mirrors the baseball
 * model layer (`@/sports/baseball/model/poissonBinomial`): guarded probs,
 * renormalised distributions, DP loops, all tunables referenced from constants.
 *
 * Serve-order is modelled exactly: games strictly alternate server within a set;
 * the tiebreak uses the official "1 then 2-at-a-time" pattern; the first server
 * of each new set flips with the parity of the previous set's total games; and
 * the match itself averages over the opening coin-toss (who serves game 1).
 */
import { clamp } from "@/engine/ev";
import type { MatchFormat } from "@/domain/tennis";
import { P_EPS, P_TALENT_MAX, P_TALENT_MIN } from "./constants";
import type { ScoreDistribution, ServeParams } from "./types";

// ---------------------------------------------------------------------------
// Game level
// ---------------------------------------------------------------------------

/**
 * Probability of winning (holding) a service game from per-point serve-win
 * probability `p`. Standard closed form:
 *   win to 0/1/2:   p^4 (1 + 4q + 10q^2)
 *   reach deuce:    C(6,3) p^3 q^3 = 20 p^3 q^3
 *   win from deuce: p^2 / (p^2 + q^2)   (ad scoring)
 * With no-ad scoring deuce is a single sudden-death point won with prob `p`.
 * `p` is clamped off the 0/1 boundary so the deuce ratio stays finite.
 */
export const gameWinProb = (p: number, noAd = false): number => {
  const pc = clamp(p, P_EPS, 1 - P_EPS);
  const q = 1 - pc;
  const noDeuce = pc ** 4 * (1 + 4 * q + 10 * q * q);
  const reachDeuce = 20 * pc ** 3 * q ** 3;
  const deuceWin = noAd ? pc : (pc * pc) / (pc * pc + q * q);
  return clamp(noDeuce + reachDeuce * deuceWin, 0, 1);
};

// ---------------------------------------------------------------------------
// Tiebreak level
// ---------------------------------------------------------------------------

/**
 * Probability player A wins a tiebreak to `to` points (win by 2), given each
 * player's serve-point-win prob. A serves point 1, then serve alternates two at
 * a time — so the server of point n (1-based) is A iff floor(n/2) is even.
 *
 * The win-by-2 deuce at (to-1, to-1) is collapsed in closed form, which is
 * EXACT here: from that score every consecutive pair of points contains exactly
 * one A-serve and one B-serve point, so over a pair P(A wins both)=pA(1-pB) and
 * P(B wins both)=(1-pA)pB regardless of order, giving the geometric ratio below.
 */
export const tiebreakWinProb = (pA: number, pB: number, to = 7): number => {
  const a = clamp(pA, P_EPS, 1 - P_EPS);
  const b = clamp(pB, P_EPS, 1 - P_EPS);
  const winBoth = a * (1 - b);
  const loseBoth = (1 - a) * b;
  const deuce = winBoth + loseBoth <= 0 ? 0.5 : winBoth / (winBoth + loseBoth);
  const memo = new Map<number, number>();
  const rec = (x: number, y: number): number => {
    if (x === to - 1 && y === to - 1) return deuce;
    if (x >= to && x - y >= 2) return 1;
    if (y >= to && y - x >= 2) return 0;
    const key = x * 1000 + y;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    const n = x + y + 1; // 1-based index of the point about to be played
    const serverA = Math.floor(n / 2) % 2 === 0;
    const winA = serverA ? a : 1 - b;
    const v = winA * rec(x + 1, y) + (1 - winA) * rec(x, y + 1);
    memo.set(key, v);
    return v;
  };
  return rec(0, 0);
};

// ---------------------------------------------------------------------------
// Set level
// ---------------------------------------------------------------------------

/** One terminal set score with the probability of reaching it. */
export interface SetOutcome {
  a: number; // games won by A
  b: number; // games won by B
  winnerA: boolean;
  totalGames: number;
  prob: number;
}

/**
 * Full distribution over terminal set scores for one set, given serve-win probs,
 * the match format, who serves the set's first game, and whether this is the
 * deciding final set (only then does `finalSetRule` apply).
 *
 * - Standard set: first to 6, win by 2; at 6-6 a tiebreak to 7 yields 7-6.
 * - Final set, "advantage": no tiebreak — win by 2 with no upper bound. The
 *   match-win mass is exact (closed-form deuce at 6-6); the rare 6-6+ extension
 *   is labelled 8-6/6-8 (its total-games count is therefore a lower bound — see
 *   ADVANTAGE note). Current tour events rarely use unlimited advantage sets.
 * - Final set, "tiebreak10": handled at the match level as a 10-point match
 *   tiebreak, not here (callers pass `isFinalSet` + rule and short-circuit).
 */
export const setOutcomes = (
  pA: number,
  pB: number,
  format: MatchFormat,
  firstServerA: boolean,
  isFinalSet: boolean,
): SetOutcome[] => {
  const holdA = gameWinProb(pA, format.noAd);
  const holdB = gameWinProb(pB, format.noAd);
  const advantage = isFinalSet && format.finalSetRule === "advantage";
  const out: SetOutcome[] = [];
  const push = (a: number, b: number, prob: number): void => {
    if (prob <= 0) return;
    out.push({ a, b, winnerA: a > b, totalGames: a + b, prob });
  };

  // P(A wins a 7-point tiebreak from this set), honouring who serves it first.
  // The player who would serve game 13 serves the tiebreak first; game 13 is odd
  // so that is the set's first server.
  const tbAwin = firstServerA
    ? tiebreakWinProb(pA, pB, 7)
    : 1 - tiebreakWinProb(pB, pA, 7);

  // Advantage 6-6 resolution (ad games, strict alternation -> one A-serve and
  // one B-serve game per pair): same geometric ratio as a tiebreak deuce.
  const advWinBoth = holdA * (1 - holdB);
  const advLoseBoth = (1 - holdA) * holdB;
  const advAwin =
    advWinBoth + advLoseBoth <= 0 ? 0.5 : advWinBoth / (advWinBoth + advLoseBoth);

  const rec = (a: number, b: number, prob: number): void => {
    // Terminal: a player has >= 6 games with a >= 2 game lead.
    if ((a >= 6 || b >= 6) && Math.abs(a - b) >= 2) {
      push(a, b, prob);
      return;
    }
    if (a === 6 && b === 6) {
      if (advantage) {
        // ADVANTAGE: exact win mass, games-count approximated as 8-6/6-8.
        push(8, 6, prob * advAwin);
        push(6, 8, prob * (1 - advAwin));
      } else {
        push(7, 6, prob * tbAwin);
        push(6, 7, prob * (1 - tbAwin));
      }
      return;
    }
    // Play the next game. Games strictly alternate server from the set's opener.
    const g = a + b + 1; // 1-based game number within the set
    const serverA = firstServerA ? g % 2 === 1 : g % 2 === 0;
    const winA = serverA ? holdA : 1 - holdB;
    rec(a + 1, b, prob * winA);
    rec(a, b + 1, prob * (1 - winA));
  };
  rec(0, 0, 1);
  // Collapse the many game-by-game PATHS into one entry per terminal scoreline.
  // rec() pushes on every distinct sequence of games, so a set yields ~1900
  // path-outcomes that share only ~19 scorelines. Left un-aggregated, foldMatch's
  // per-set Cartesian product explodes (~1900^3 ≈ 7e9 leaves) and hangs the match
  // projection. Aggregating here is exact: totalGames/winnerA are functions of
  // (a,b), so summing prob per scoreline loses nothing.
  const agg = new Map<string, SetOutcome>();
  for (const o of out) {
    const key = `${o.a}-${o.b}`;
    const prev = agg.get(key);
    if (prev) prev.prob += o.prob;
    else agg.set(key, { ...o });
  }
  return [...agg.values()];
};

/** P(A wins one set) — first-server-averaged unless `firstServerA` is pinned. */
export const setWinProb = (
  pA: number,
  pB: number,
  format: MatchFormat,
  firstServerA?: boolean,
  isFinalSet = false,
): number => {
  const fold = (fa: boolean): number =>
    setOutcomes(pA, pB, format, fa, isFinalSet)
      .filter((o) => o.winnerA)
      .reduce((s, o) => s + o.prob, 0);
  if (firstServerA !== undefined) return fold(firstServerA);
  return 0.5 * (fold(true) + fold(false));
};

/** Distribution over set game-scores ("6-4" -> prob), first-server-averaged. */
export const setGamesDistribution = (
  pA: number,
  pB: number,
  format: MatchFormat,
  firstServerA?: boolean,
  isFinalSet = false,
): ScoreDistribution => {
  const dist: ScoreDistribution = {};
  const add = (outs: SetOutcome[], w: number): void => {
    for (const o of outs) {
      const key = `${o.a}-${o.b}`;
      dist[key] = (dist[key] ?? 0) + w * o.prob;
    }
  };
  if (firstServerA !== undefined) {
    add(setOutcomes(pA, pB, format, firstServerA, isFinalSet), 1);
  } else {
    add(setOutcomes(pA, pB, format, true, isFinalSet), 0.5);
    add(setOutcomes(pA, pB, format, false, isFinalSet), 0.5);
  }
  return dist;
};

// ---------------------------------------------------------------------------
// Match level
// ---------------------------------------------------------------------------

const setsToWin = (format: MatchFormat): number => (format.bestOf === 5 ? 3 : 2);

/** Aggregated per-set outcomes for both opening-server cases (memo per call). */
interface SetTables {
  normalA: SetOutcome[];
  normalB: SetOutcome[];
  finalA: SetOutcome[];
  finalB: SetOutcome[];
}

const buildSetTables = (
  pA: number,
  pB: number,
  format: MatchFormat,
): SetTables => ({
  normalA: setOutcomes(pA, pB, format, true, false),
  normalB: setOutcomes(pA, pB, format, false, false),
  finalA: setOutcomes(pA, pB, format, true, true),
  finalB: setOutcomes(pA, pB, format, false, true),
});

/** Match-tiebreak deciding set (finalSetRule "tiebreak10"): 10-pt match TB. */
const matchTiebreakOutcomes = (
  pA: number,
  pB: number,
  firstServerA: boolean,
): SetOutcome[] => {
  const aWin = firstServerA
    ? tiebreakWinProb(pA, pB, 10)
    : 1 - tiebreakWinProb(pB, pA, 10);
  // Counted as a single decisive game for the total-games tally (feed convention
  // varies; match-win mass is exact).
  return [
    { a: 1, b: 0, winnerA: true, totalGames: 1, prob: aWin },
    { a: 0, b: 1, winnerA: false, totalGames: 1, prob: 1 - aWin },
  ];
};

/**
 * Fold sets into a match for ONE opening server, invoking `onLeaf` at every
 * match-terminal with (setsA, setsB, totalGames, prob). The next set's first
 * server flips with the parity of the completed set's total games.
 */
const foldMatch = (
  pA: number,
  pB: number,
  format: MatchFormat,
  tables: SetTables,
  openingServerA: boolean,
  onLeaf: (setsA: number, setsB: number, games: number, prob: number) => void,
): void => {
  const need = setsToWin(format);
  const isMatchTb = format.finalSetRule === "tiebreak10";
  const recur = (
    setsA: number,
    setsB: number,
    firstA: boolean,
    games: number,
    prob: number,
  ): void => {
    if (setsA === need || setsB === need) {
      onLeaf(setsA, setsB, games, prob);
      return;
    }
    const isFinal = setsA === need - 1 && setsB === need - 1;
    let table: SetOutcome[];
    if (isFinal && isMatchTb) table = matchTiebreakOutcomes(pA, pB, firstA);
    else if (isFinal) table = firstA ? tables.finalA : tables.finalB;
    else table = firstA ? tables.normalA : tables.normalB;
    for (const o of table) {
      const np = prob * o.prob;
      if (np <= 0) continue;
      const nextFirst = o.totalGames % 2 === 1 ? !firstA : firstA;
      recur(
        setsA + (o.winnerA ? 1 : 0),
        setsB + (o.winnerA ? 0 : 1),
        nextFirst,
        games + o.totalGames,
        np,
      );
    }
  };
  recur(0, 0, openingServerA, 0, 1);
};

/** Assembled match-level probabilities derived purely from (spwA, spwB). */
export interface MatchProbabilities {
  pMatchWin: number; // P(A wins the match)
  setScoreDistribution: ScoreDistribution; // "2-1" -> prob (A's sets first)
  gamesDistribution: ScoreDistribution; // total match games "21" -> prob
}

/**
 * Full match projection from serve params: P(A wins), the set-score distribution
 * and the total-games distribution. Averages over the opening coin-toss so the
 * model is exactly symmetric under swapping the two players.
 */
export const projectMatchProbabilities = (
  params: ServeParams,
  format: MatchFormat,
): MatchProbabilities => {
  const pA = clamp(params.spwA, P_TALENT_MIN, P_TALENT_MAX);
  const pB = clamp(params.spwB, P_TALENT_MIN, P_TALENT_MAX);
  const tables = buildSetTables(pA, pB, format);
  const setScoreDistribution: ScoreDistribution = {};
  const gamesDistribution: ScoreDistribution = {};
  let pMatchWin = 0;
  const onLeaf = (setsA: number, setsB: number, games: number, prob: number): void => {
    const w = 0.5 * prob; // each opening-server case carries half the mass
    if (setsA > setsB) pMatchWin += w;
    const sk = `${setsA}-${setsB}`;
    setScoreDistribution[sk] = (setScoreDistribution[sk] ?? 0) + w;
    const gk = `${games}`;
    gamesDistribution[gk] = (gamesDistribution[gk] ?? 0) + w;
  };
  foldMatch(pA, pB, format, tables, true, onLeaf);
  foldMatch(pA, pB, format, tables, false, onLeaf);
  return { pMatchWin, setScoreDistribution, gamesDistribution };
};

/** P(A wins the match) from serve params (convenience wrapper). */
export const matchWinProb = (
  pA: number,
  pB: number,
  format: MatchFormat,
): number => projectMatchProbabilities({ spwA: pA, spwB: pB }, format).pMatchWin;

/** Distribution over total match games (convenience wrapper). */
export const matchGamesDistribution = (
  pA: number,
  pB: number,
  format: MatchFormat,
): ScoreDistribution =>
  projectMatchProbabilities({ spwA: pA, spwB: pB }, format).gamesDistribution;

// ---------------------------------------------------------------------------
// Elo reconciliation
// ---------------------------------------------------------------------------

/**
 * Reconcile serve params so the model's P(A wins match) matches an external
 * target (surface-Elo win prob). Elo decides WHO wins; serve stats decide HOW
 * games distribute. We hold the combined serve dominance (spwA + spwB) fixed and
 * shift the SPREAD by a single offset delta — spwA+delta / spwB-delta — solving
 * matchWinProb == target by bisection. matchWinProb is monotonic increasing in
 * delta, so bisection converges; the offset is clamped to keep both spw within
 * [P_TALENT_MIN, P_TALENT_MAX]. If the target is unreachable inside those bounds
 * the nearest reachable endpoint is returned.
 */
export const reconcileSpwToMatchProb = (
  params: ServeParams,
  targetPMatchWin: number,
  format: MatchFormat,
  iters = 32,
): ServeParams => {
  const baseA = clamp(params.spwA, P_TALENT_MIN, P_TALENT_MAX);
  const baseB = clamp(params.spwB, P_TALENT_MIN, P_TALENT_MAX);
  const target = clamp(targetPMatchWin, P_EPS, 1 - P_EPS);
  // delta range keeps spwA+delta and spwB-delta inside the clamp window.
  const hi = Math.min(P_TALENT_MAX - baseA, baseB - P_TALENT_MIN);
  const lo = Math.max(P_TALENT_MIN - baseA, baseB - P_TALENT_MAX);
  if (hi <= lo) return { spwA: baseA, spwB: baseB };
  const probAt = (delta: number): number =>
    matchWinProb(baseA + delta, baseB - delta, format);
  let l = lo;
  let r = hi;
  const fl = probAt(l) - target;
  const fr = probAt(r) - target;
  // Target outside reachable band -> clamp to nearest endpoint.
  if (fl >= 0) return { spwA: baseA + l, spwB: baseB - l };
  if (fr <= 0) return { spwA: baseA + r, spwB: baseB - r };
  for (let i = 0; i < iters; i++) {
    const m = (l + r) / 2;
    if (probAt(m) - target < 0) l = m;
    else r = m;
  }
  const delta = (l + r) / 2;
  return {
    spwA: clamp(baseA + delta, P_TALENT_MIN, P_TALENT_MAX),
    spwB: clamp(baseB - delta, P_TALENT_MIN, P_TALENT_MAX),
  };
};
