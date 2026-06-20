/**
 * Tunable numeric constants for the pitcher strikeout projection model.
 *
 * This is the single source of truth for every magic number the model uses.
 * Values flagged TODO(calibration) are first-pass estimates from 2025 MLB data
 * (model-architect / stats-researcher) and are expected to be grid-searched once
 * a backtest harness exists. Keep all model tunables here — no literals in the
 * math modules.
 */

// League per-PA strikeout rate (2025 full season: 40,645 K / 182,926 BF = 0.2222).
export const LEAGUE_K_RATE = 0.222;

// SwStr% -> implied K%: empirical fit K% = 0.003 + 1.85*SwStr% (r=0.86, R^2=0.74, 2023).
// DAMPEN slope by 0.85 when used as a shrinkage TARGET — SwStr% carries its own
// measurement noise; cross-sectional slope over-reaches on the tails. TODO(calibration).
export const SWSTR_K_INTERCEPT = 0.003;
export const SWSTR_K_SLOPE = 1.85;
export const SWSTR_K_SLOPE_DAMPEN = 0.85;

// CSW% -> implied K%: K% = -0.21 + 1.5*CSW% (R^2 0.67-0.72). Weaker than SwStr%;
// only used when whiffPct absent but cswPct present.
export const CSW_K_INTERCEPT = -0.21;
export const CSW_K_SLOPE = 1.5;

// Pitcher K-talent blend: p_talent = W_SEASON*kPct_season_shrunk + (1-W_SEASON)*kPct_stuff.
// Default leans on season rate; stuff (SwStr/CSW) is the corroborating signal.
export const W_SEASON = 0.6; // TODO(calibration): grid 0.5-0.7

// Small-sample shrinkage of season kPct toward LEAGUE_K_RATE:
//   kPct_shrunk = (BF*kPct + K_SHRINK_PA*LEAGUE_K_RATE) / (BF + K_SHRINK_PA)
// ~ a full season of BF (≈170 BF/100IP region); regress hard early-season.
export const K_SHRINK_PA = 300; // pseudo-BF prior weight. TODO(calibration)

// Batter split shrinkage toward batter overall (or league if overall absent):
//   B_shrunk = (paSide*kPctSide + B_SHRINK_PA*prior) / (paSide + B_SHRINK_PA)
export const B_SHRINK_PA = 100; // PA prior weight for vsL/vsR splits. TODO(calibration)

// Platoon adjustment (additive pp on the pitcher's talent rate, SAME-side batter).
// LHP gap noisier/larger; RHP gap stable. Opposite-side ~ -1pp baked via these.
export const PLATOON_SAME_SIDE_RHP = 0.011; // RHP vs RHB: +1.1pp
export const PLATOON_SAME_SIDE_LHP = 0.026; // LHP vs LHB: +2.6pp (noisy; TODO(calibration))

// Batters-faced start-length distribution.
export const BF_MEAN_DEFAULT = 23.6; // 2025 qualified starters mean BF/GS
export const BF_RECENT_N = 5; // last N starts for recent-form mean
export const BF_SHRINK_STARTS = 10; // shrink recent mean toward season mean by this many pseudo-starts
export const BF_DISPERSION = "poisson" as const; // within-pitcher SD≈4 ≈ sqrt(23.6); Poisson fits
export const BF_PMF_FLOOR = 12; // truncate BF support
export const BF_PMF_CEIL = 34; // truncate BF support (cover blowout/CG tails)
export const BF_MARKET_BLEND = 0.5; // weight on marketOutsLine-implied BF mean when provided

// marketOutsLine -> implied BF: outs -> innings -> BF, inflated for baserunners.
// bfFromOuts = marketOutsLine / 3 / (1 - BASERUNNER_RATE). 0.31 ≈ league
// OBP-ish baserunner rate. TODO(calibration).
export const BASERUNNER_RATE = 0.31;

// Probability clamps shared across the model.
export const P_EPS = 1e-6; // clamp probs into [P_EPS, 1 - P_EPS] before log5
export const P_TALENT_MIN = 0.01; // clamp pitcher talent after platoon
export const P_TALENT_MAX = 0.6;

// Confidence is independent + multiplicative from a single FULL base: each
// missing input applies its own penalty. Severity ordering is real: missing the
// lineup (which 9 batters) is MAJOR; missing Savant "stuff" is MINOR (season K%
// still carries the projection); missing batter splits is minor. So a confirmed
// lineup with no Savant must out-rank an unconfirmed lineup. The `tier` label is
// purely descriptive of which data is absent — it does NOT drive confidence.
export const CONF_BASE_FULL = 0.9;
export const CONF_NO_SAVANT_MULT = 0.9; // no SwStr/CSW stuff signal — minor
export const CONF_NO_LINEUP_MULT = 0.6; // lineup unconfirmed — major
export const CONF_NO_SPLITS_MULT = 0.85; // lineup confirmed but no batter splits
// No outing-length anchor (no Pitcher Outs O/U line AND no recent starts) — BF
// is a generic default, so the projection is untrustworthy (openers/short
// outings over-project Ks). Severe: pushes confidence below the bet floor even
// with otherwise-full data (0.9 × 0.45 ≈ 0.40 < MIN_CONFIDENCE 0.45).
export const CONF_NO_BF_ANCHOR_MULT = 0.45;
