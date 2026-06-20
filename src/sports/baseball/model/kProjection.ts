/**
 * Pitcher strikeout projection orchestrator.
 *
 * `projectStrikeouts` blends a pitcher's season K-rate (shrunk) with a Savant
 * "stuff" signal, applies a per-batter platoon adjustment, derives each batter's
 * shrunk K-rate split, combines them via log5 into per-PA strikeout probs, and
 * mixes a Poisson-Binomial K distribution over a Poisson batters-faced (BF)
 * distribution. Pure and deterministic; missing data degrades the tier rather
 * than throwing.
 */
import { clamp } from "@/engine/ev";
import type {
  BatterKSplits,
  Handedness,
  LineupSlot,
  PitcherGameLog,
  PitcherSeasonStats,
  SavantPitcherProfile,
} from "@/domain/baseball";
import {
  BASERUNNER_RATE,
  BF_MARKET_BLEND,
  BF_MEAN_DEFAULT,
  BF_PMF_CEIL,
  BF_RECENT_N,
  BF_SHRINK_STARTS,
  B_SHRINK_PA,
  CONF_BASE_FULL,
  CONF_NO_BF_ANCHOR_MULT,
  CONF_NO_LINEUP_MULT,
  CONF_NO_SAVANT_MULT,
  CONF_NO_SPLITS_MULT,
  CSW_K_INTERCEPT,
  CSW_K_SLOPE,
  K_SHRINK_PA,
  LEAGUE_K_RATE,
  PLATOON_SAME_SIDE_LHP,
  PLATOON_SAME_SIDE_RHP,
  P_TALENT_MAX,
  P_TALENT_MIN,
  SWSTR_K_INTERCEPT,
  SWSTR_K_SLOPE,
  SWSTR_K_SLOPE_DAMPEN,
  W_SEASON,
} from "./constants";
import {
  bfPoissonDistribution,
  log5K,
  mixStrikeoutPmf,
  pmfMean,
  tailOver,
} from "./poissonBinomial";
import type {
  KProjection,
  KProjectionTier,
  ProjectStrikeoutsArgs,
  SavantSource,
} from "./types";

/** Shrink a season K-rate toward the league rate by K_SHRINK_PA pseudo-BF. */
const shrinkSeasonK = (kPct: number, battersFaced: number): number => {
  const bf = Math.max(0, battersFaced);
  return (bf * kPct + K_SHRINK_PA * LEAGUE_K_RATE) / (bf + K_SHRINK_PA);
};

/**
 * Savant "stuff" K-rate: prefer SwStr% (whiffPct, dampened slope), else CSW%
 * (cswPct). Returns the implied rate and which signal was used.
 */
const stuffKRate = (
  savant: SavantPitcherProfile | undefined,
): { rate: number | undefined; source: SavantSource } => {
  if (savant?.whiffPct !== undefined) {
    const rate =
      SWSTR_K_INTERCEPT + SWSTR_K_SLOPE * SWSTR_K_SLOPE_DAMPEN * savant.whiffPct;
    return { rate, source: "swstr" };
  }
  if (savant?.cswPct !== undefined) {
    const rate = CSW_K_INTERCEPT + CSW_K_SLOPE * savant.cswPct;
    return { rate, source: "csw" };
  }
  return { rate: undefined, source: "none" };
};

/**
 * Platoon adjustment: additive same-side bonus when the batter bats the same
 * hand the pitcher throws. Switch hitters (bats "S") and unknown sides bat
 * opposite by choice -> no bonus. Result clamped to [P_TALENT_MIN, P_TALENT_MAX].
 */
const platoonAdjusted = (
  pTalent: number,
  throws: Handedness,
  bats: LineupSlot["bats"],
): number => {
  const sameSide =
    (throws === "R" && bats === "R") || (throws === "L" && bats === "L");
  const bonus = sameSide
    ? throws === "R"
      ? PLATOON_SAME_SIDE_RHP
      : PLATOON_SAME_SIDE_LHP
    : 0;
  return clamp(pTalent + bonus, P_TALENT_MIN, P_TALENT_MAX);
};

/**
 * Batter's K-rate vs the pitcher's hand, shrunk toward LEAGUE_K_RATE by
 * B_SHRINK_PA. RHP -> use vsR split, LHP -> vsL split. Missing side -> prior.
 */
const batterKRate = (
  splits: BatterKSplits | undefined,
  throws: Handedness,
): number => {
  const prior = LEAGUE_K_RATE; // Phase-1 BatterKSplits has no overall field.
  if (!splits) return prior;
  const kPctSide = throws === "R" ? splits.kPctVsR : splits.kPctVsL;
  const paSide = (throws === "R" ? splits.paVsR : splits.paVsL) ?? 0;
  if (kPctSide === undefined) return prior;
  return (paSide * kPctSide + B_SHRINK_PA * prior) / (paSide + B_SHRINK_PA);
};

/** Mean BF/start from the last BF_RECENT_N starts (gamesStarted===1), by date desc. */
const recentBfMean = (gamelogs: PitcherGameLog[]): number | undefined => {
  const starts = gamelogs
    .filter((g) => g.gamesStarted === 1)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, BF_RECENT_N);
  if (starts.length === 0) return undefined;
  // Use battersFaced directly — never derive BF from inningsPitched (the "3.1"
  // decimal encodes thirds of an inning, not a fraction).
  const sum = starts.reduce((acc, g) => acc + g.battersFaced, 0);
  return sum / starts.length;
};

/** Season mean BF/start, falling back to the league default when no starts. */
const seasonBfMean = (pitcher: PitcherSeasonStats): number => {
  if (pitcher.gamesStarted <= 0) return BF_MEAN_DEFAULT;
  return pitcher.battersFaced / pitcher.gamesStarted;
};

/**
 * Projected mean batters faced: recent-form mean shrunk toward season mean,
 * then optionally blended with a market-implied BF mean derived from a Pitcher
 * Outs O/U line.
 *
 * `bfAnchored` reports whether the outing LENGTH had a real signal — a Pitcher
 * Outs O/U line OR the pitcher's own recent starts. Without either we fall back
 * to BF_MEAN_DEFAULT (a generic full start), which is dangerous: an opener /
 * bullpen game / short outing gets projected as a normal starter and the model
 * massively over-projects Ks. Callers drop confidence below the bet floor when
 * unanchored so these never become plays.
 */
const projectBfMean = (
  pitcher: PitcherSeasonStats,
  gamelogs: PitcherGameLog[],
  marketOutsLine: number | undefined,
): { bfMean: number; usedMarketOutsLine: boolean; bfAnchored: boolean } => {
  const seasonMean = seasonBfMean(pitcher);
  const recent = recentBfMean(gamelogs);
  let bfMean: number;
  if (recent === undefined) {
    bfMean = seasonMean;
  } else {
    // nRecent is the actual count of recent starts used (≤ BF_RECENT_N).
    const nRecent = Math.min(
      BF_RECENT_N,
      gamelogs.filter((g) => g.gamesStarted === 1).length,
    );
    bfMean =
      (nRecent * recent + BF_SHRINK_STARTS * seasonMean) /
      (nRecent + BF_SHRINK_STARTS);
  }
  let usedMarketOutsLine = false;
  if (marketOutsLine !== undefined && marketOutsLine > 0) {
    // Outs recorded -> batters faced: BF = outs / (1 - baserunnerRate). NO /3 —
    // the line is already in OUTS (16.5 = 5.5 IP), not innings; over BF batters
    // outs ≈ BF·(1 - reachRate).
    const bfFromOuts = marketOutsLine / (1 - BASERUNNER_RATE);
    bfMean = BF_MARKET_BLEND * bfFromOuts + (1 - BF_MARKET_BLEND) * bfMean;
    usedMarketOutsLine = true;
  }
  const bfAnchored = usedMarketOutsLine || recent !== undefined;
  return { bfMean, usedMarketOutsLine, bfAnchored };
};

/**
 * Build the per-PA strikeout probability list up to BF_PMF_CEIL. PA index t
 * cycles the 9-slot lineup (t-1 mod 9). Each entry combines the batter's shrunk
 * split (B) with the platoon-adjusted pitcher talent (P) via log5.
 */
const buildPerPaProbs = (
  pTalent: number,
  throws: Handedness,
  lineup: LineupSlot[],
  batterSplits: Record<number, BatterKSplits>,
): number[] => {
  const probs: number[] = [];
  const n = lineup.length;
  for (let t = 0; t < BF_PMF_CEIL; t++) {
    const slot = lineup[t % n];
    const P = platoonAdjusted(pTalent, throws, slot.bats);
    const B = batterKRate(batterSplits[slot.playerId], throws);
    probs.push(log5K(P, B, LEAGUE_K_RATE));
  }
  return probs;
};

/** Fraction of lineup slots with a known bat side (drives confidence). */
const lineupBatsKnownFrac = (lineup: LineupSlot[]): number => {
  if (lineup.length === 0) return 0;
  const known = lineup.filter((s) => s.bats !== undefined).length;
  return known / lineup.length;
};

/** A synthetic 9-batter league-average lineup for the unconfirmed (partial) tier. */
const leagueAverageLineup = (): LineupSlot[] =>
  Array.from({ length: 9 }, (_, i) => ({
    battingOrder: i + 1,
    playerId: -1 - i, // sentinel ids; never match real splits -> league prior B
    name: "League Avg",
  }));

export const projectStrikeouts = (args: ProjectStrikeoutsArgs): KProjection => {
  const { pitcher, throws, gamelogs, savant, marketOutsLine } = args;

  // --- Pitcher K-talent (P pre-platoon) ---
  const seasonShrunk = shrinkSeasonK(pitcher.kPct, pitcher.battersFaced);
  const { rate: stuff, source: savantSource } = stuffKRate(savant);
  const pitcherTalentK =
    stuff === undefined
      ? seasonShrunk
      : W_SEASON * seasonShrunk + (1 - W_SEASON) * stuff;

  // --- Lineup resolution + tier ---
  const lineupConfirmed = args.opponentLineup.length > 0;
  const lineup = lineupConfirmed ? args.opponentLineup : leagueAverageLineup();
  const haveSplits = lineupConfirmed
    ? lineup.some((s) => args.batterSplits[s.playerId] !== undefined)
    : false;

  // Descriptive label only — does NOT drive confidence (see below).
  let tier: KProjectionTier;
  if (!lineupConfirmed) {
    tier = "partial"; // major gap: synthesized league-average batters
  } else if (savantSource === "none") {
    tier = "low"; // lineup present, only the Savant stuff signal missing
  } else {
    tier = "full";
  }

  // --- BF distribution ---
  const { bfMean, usedMarketOutsLine, bfAnchored } = projectBfMean(
    pitcher,
    gamelogs,
    marketOutsLine,
  );
  const bfDist = bfPoissonDistribution(bfMean);

  // --- Per-PA probs + mixed K pmf ---
  const perPaProbs = buildPerPaProbs(
    pitcherTalentK,
    throws,
    lineup,
    args.batterSplits,
  );
  const pmf = mixStrikeoutPmf(perPaProbs, bfDist);
  const expectedKs = pmfMean(pmf);

  // --- Confidence: single FULL base × independent data-completeness penalties.
  // Each missing input penalises on its own (no ordered tier base), so a
  // confirmed lineup without Savant out-ranks an unconfirmed lineup. ---
  const batsFrac = lineupBatsKnownFrac(lineup);
  let confidence = CONF_BASE_FULL;
  if (savantSource === "none") confidence *= CONF_NO_SAVANT_MULT;
  if (!lineupConfirmed) confidence *= CONF_NO_LINEUP_MULT;
  if (lineupConfirmed && !haveSplits) confidence *= CONF_NO_SPLITS_MULT;
  // No outing-length anchor (no Outs O/U line AND no recent starts) → BF is a
  // generic guess; heavy penalty so unanchored projections fall below the bet
  // floor. Prevents over-projecting openers / short outings (false edges).
  if (!bfAnchored) confidence *= CONF_NO_BF_ANCHOR_MULT;
  confidence *= 0.7 + 0.3 * batsFrac;
  confidence = clamp(confidence, 0, 1);

  return {
    expectedKs,
    pmf,
    pOver: (line: number) => tailOver(pmf, line),
    confidence,
    inputsUsed: {
      tier,
      pitcherTalentK,
      leagueK: LEAGUE_K_RATE,
      bfMean,
      usedMarketOutsLine,
      bfAnchored,
      savantSource,
      lineupConfirmed,
      battersModeled: lineup.length,
    },
  };
};
