CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bankroll_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at TEXT NOT NULL,
  kind TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  balance_after_minor INTEGER NOT NULL,
  bet_id TEXT,
  note TEXT
);
CREATE INDEX IF NOT EXISTS ix_ledger_time ON bankroll_ledger(occurred_at);

CREATE TABLE IF NOT EXISTS bets (
  id TEXT PRIMARY KEY,
  placed_at TEXT NOT NULL,
  match_id TEXT NOT NULL,
  league_id TEXT NOT NULL,
  market_key TEXT NOT NULL,
  selection_json TEXT NOT NULL,
  price_decimal REAL NOT NULL,
  book TEXT NOT NULL,
  stake_units REAL NOT NULL,
  stake_minor INTEGER NOT NULL,
  status TEXT NOT NULL,
  settled_at TEXT,
  payout_minor INTEGER,
  closing_price_decimal REAL,
  notes TEXT,
  play_snapshot_json TEXT
);
CREATE INDEX IF NOT EXISTS ix_bets_match ON bets(match_id);
CREATE INDEX IF NOT EXISTS ix_bets_status ON bets(status);

CREATE TABLE IF NOT EXISTS odds_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id TEXT NOT NULL,
  market_key TEXT NOT NULL,
  selection_key TEXT NOT NULL,
  price_decimal REAL NOT NULL,
  book TEXT NOT NULL,
  taken_at TEXT NOT NULL,
  is_opener INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_snap_match ON odds_snapshots(match_id, market_key);

CREATE TABLE IF NOT EXISTS strategy_rules_config (
  rule_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  weight REAL NOT NULL DEFAULT 1.0,
  params_json TEXT
);

CREATE TABLE IF NOT EXISTS matches_cache (
  match_id TEXT PRIMARY KEY,
  league_id TEXT NOT NULL,
  kickoff_at TEXT NOT NULL,
  home_json TEXT NOT NULL,
  away_json TEXT NOT NULL,
  source TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_matches_kickoff ON matches_cache(kickoff_at);
CREATE INDEX IF NOT EXISTS ix_matches_league ON matches_cache(league_id);

CREATE TABLE IF NOT EXISTS match_resolution (
  catalog_source TEXT NOT NULL,
  catalog_id TEXT NOT NULL,
  odds_event_id TEXT,
  resolved_at TEXT NOT NULL,
  confidence REAL NOT NULL,
  PRIMARY KEY (catalog_source, catalog_id)
);
