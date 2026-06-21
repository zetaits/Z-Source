// CLV (Closing Line Value) summary for MLB pitcher-strikeout props. Pure — no
// DB, no React — so it's trivially unit-testable. The per-bet odds CLV math
// already lives in domain/bet.ts (clvPct); this module adds three things the
// raw odds delta can't express:
//   1. a LINE-move signal (the book moved the Ks line in our favour),
//   2. a MODEL-vs-CLOSE signal (our model fair prob landed on the right side of
//      where the book's no-vig closing prob settled), and
//   3. an aggregate "are we beating the close?" summary that gates the manual
//      switch from flat staking to ¼-Kelly once enough plays are logged.
// All three are derivable from data already persisted (bet.playSnapshot +
// odds_snapshots) — no new fields, no migration.
// Football bets (no player prop) are ignored — this is a props-only report.

import type { Bet } from "@/domain/bet";
import { clvPct } from "@/domain/bet";

/** Min logged plays before the ¼-Kelly switch is worth considering. */
export const KELLY_READINESS_THRESHOLD = 20;

const PROP_MARKET = "PITCHER_KS";

/** A persisted Ks line offer, narrowed to what the line-move helper needs. */
export interface PropLineSnapshot {
  side: string;
  line: number | undefined;
  priceDecimal: number;
  /** Pitcher name, for matching snapshots to a specific bet's player. */
  player?: string;
}

/**
 * Parse a prop selectionKey ("PITCHER_KS:over@5.5|Rhett Lowder") back into its
 * parts. Mirrors selectionKey() in domain/market.ts. Returns null for keys that
 * aren't player-prop O/U lines (e.g. football keys, no line), so callers can
 * skip them. Pure string parsing — kept here so it's covered by these tests.
 */
export const parsePropSelectionKey = (
  key: string,
): { side: string; line: number; player: string } | null => {
  const [marketAndSel, player] = key.split("|");
  if (!player) return null;
  const colon = marketAndSel.indexOf(":");
  if (colon < 0) return null;
  const sideAndLine = marketAndSel.slice(colon + 1);
  const at = sideAndLine.indexOf("@");
  if (at < 0) return null;
  const side = sideAndLine.slice(0, at);
  const line = Number(sideAndLine.slice(at + 1));
  if (!side || Number.isNaN(line)) return null;
  return { side, line, player };
};

/**
 * Did the Ks line move in the bettor's favour by close? For an OVER, a LOWER
 * line at close is better (fewer Ks needed); for an UNDER, a HIGHER line is
 * better. We compare the bet's line against the most favourable line seen among
 * same-side snapshots. Returns null when we can't tell (no line, no snapshots).
 */
export const lineMovedFavorably = (
  bet: Bet,
  snapshots: PropLineSnapshot[],
): boolean | null => {
  const betLine = bet.selection.line;
  const side = bet.selection.side;
  const player = bet.selection.player;
  if (betLine === undefined) return null;
  const sameSide = snapshots.filter(
    (s) =>
      s.side === side &&
      s.line !== undefined &&
      (player === undefined || s.player === undefined || s.player === player),
  );
  if (sameSide.length === 0) return null;
  const lines = sameSide.map((s) => s.line as number);
  if (side === "over") {
    // Better = lower line available by close.
    return Math.min(...lines) < betLine;
  }
  if (side === "under") {
    // Better = higher line available by close.
    return Math.max(...lines) > betLine;
  }
  return null;
};

/** Latest snapshot for a given side at the bet's line (snapshots arrive oldest→newest). */
const latestAtBetLine = (
  snapshots: PropLineSnapshot[],
  side: string,
  line: number,
  player: string | undefined,
): PropLineSnapshot | undefined => {
  let found: PropLineSnapshot | undefined;
  for (const s of snapshots) {
    if (
      s.side === side &&
      s.line === line &&
      (player === undefined || s.player === undefined || s.player === player)
    ) {
      found = s;
    }
  }
  return found;
};

/**
 * Did the MODEL's fair prob beat the book's closing no-vig prob? The bet stores
 * the model fair prob it was taken on (playSnapshot.fairProb); the close is the
 * de-vigged Bet365 over/under at the same line. We de-vig EXACTLY as analyze.ts
 * does (impOver=1/overDec, impUnder=1/underDec, fair=imp/(impOver+impUnder)) so
 * model and book are on the same no-vig footing. "Model beat the close" = the
 * model's fair prob for the BET SIDE exceeded the book's closing fair prob for
 * that side — i.e. we were on the value side of where the line settled. Returns
 * null when we can't measure (no model snapshot, no line, or only one closing
 * side captured) so the caller falls back to price-only CLV.
 */
export const modelBeatClose = (
  bet: Bet,
  snapshots: PropLineSnapshot[],
): boolean | null => {
  const line = bet.selection.line;
  const side = bet.selection.side;
  const modelFair = bet.playSnapshot?.fairProb;
  if (line === undefined || modelFair === undefined) return null;
  if (side !== "over" && side !== "under") return null;

  const player = bet.selection.player;
  const overSnap = latestAtBetLine(snapshots, "over", line, player);
  const underSnap = latestAtBetLine(snapshots, "under", line, player);
  if (!overSnap || !underSnap) return null; // need both sides to de-vig
  if (overSnap.priceDecimal <= 0 || underSnap.priceDecimal <= 0) return null;

  const impOver = 1 / overSnap.priceDecimal;
  const impUnder = 1 / underSnap.priceDecimal;
  const denom = impOver + impUnder;
  if (denom <= 0) return null;
  const closeFairOver = impOver / denom;
  const closeFairForSide = side === "over" ? closeFairOver : 1 - closeFairOver;

  return modelFair > closeFairForSide;
};

/**
 * A bet "beats the close" if ANY axis is favourable: odds CLV positive, the Ks
 * line moved our way, OR the model's fair prob beat the book's closing no-vig
 * prob. Returns null only when no axis is measurable.
 */
export const beatClose = (
  bet: Bet,
  snapshots: PropLineSnapshot[] = [],
): boolean | null => {
  const odds = clvPct(bet);
  const line = lineMovedFavorably(bet, snapshots);
  const model = modelBeatClose(bet, snapshots);
  if (odds === null && line === null && model === null) return null;
  return (odds !== null && odds > 0) || line === true || model === true;
};

export interface ClvSummary {
  /** Logged PITCHER_KS plays (any status). */
  nPlays: number;
  /** Of those, how many have a captured closing price (CLV measurable). */
  nWithClose: number;
  /** Fraction of measurable plays that beat the close (0..1). */
  pctBeatClose: number;
  /** Mean odds CLV over measurable plays (fraction, e.g. 0.03 = +3%). */
  avgClvPct: number;
  /** True once enough plays are logged to consider switching to ¼-Kelly. */
  kellyReady: boolean;
}

/** Keep only the prop bets this report covers. */
export const isPropBet = (bet: Bet): boolean => bet.marketKey === PROP_MARKET;

/**
 * Aggregate CLV over the logged prop bets. `snapshotsByBet` is an optional
 * lookup of same-market line snapshots per bet id, used only for the line-move
 * dimension of beatClose; omit it and beatClose falls back to odds CLV alone.
 */
export const clvSummary = (
  bets: Bet[],
  snapshotsByBet: Record<string, PropLineSnapshot[]> = {},
): ClvSummary => {
  const props = bets.filter(isPropBet);
  const nPlays = props.length;

  let nWithClose = 0;
  let beat = 0;
  let clvSum = 0;
  let clvCount = 0;

  for (const bet of props) {
    const odds = clvPct(bet);
    const snaps = snapshotsByBet[String(bet.id)] ?? [];
    const beats = beatClose(bet, snaps);
    if (odds !== null) {
      clvSum += odds;
      clvCount += 1;
    }
    if (beats !== null) {
      nWithClose += 1;
      if (beats) beat += 1;
    }
  }

  return {
    nPlays,
    nWithClose,
    pctBeatClose: nWithClose > 0 ? beat / nWithClose : 0,
    avgClvPct: clvCount > 0 ? clvSum / clvCount : 0,
    kellyReady: nPlays >= KELLY_READINESS_THRESHOLD,
  };
};
