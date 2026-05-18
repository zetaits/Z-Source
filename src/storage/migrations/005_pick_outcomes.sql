-- 005: pick_outcomes — track engine-suggested plays and their realised outcomes
-- Independent from bets table: pick_outcomes records what the engine SUGGESTED
-- (and what later happened), regardless of whether the user actually placed a bet.
-- Use cases: model calibration, hit-rate / ROI metrics per verdict × market.

CREATE TABLE IF NOT EXISTS pick_outcomes (
  play_id TEXT PRIMARY KEY,
  generated_at TEXT NOT NULL,
  match_id TEXT NOT NULL,
  league_id TEXT,
  market_key TEXT NOT NULL,
  selection_json TEXT NOT NULL,
  verdict TEXT NOT NULL,
  edge_pct REAL NOT NULL,
  fair_prob REAL NOT NULL,
  confidence REAL NOT NULL,
  price_decimal REAL NOT NULL,
  stake_units REAL NOT NULL,
  outcome TEXT NOT NULL DEFAULT 'PENDING',
  payout_units REAL,
  settled_at TEXT,
  bet_id TEXT
);

CREATE INDEX IF NOT EXISTS ix_pick_outcomes_verdict ON pick_outcomes(verdict);
CREATE INDEX IF NOT EXISTS ix_pick_outcomes_market ON pick_outcomes(market_key);
CREATE INDEX IF NOT EXISTS ix_pick_outcomes_settled ON pick_outcomes(settled_at);
CREATE INDEX IF NOT EXISTS ix_pick_outcomes_bet ON pick_outcomes(bet_id);
