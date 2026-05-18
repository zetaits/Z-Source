-- 006: historical_odds — bulk historical match results + closing odds for backtest
-- Source: football-data.co.uk CSVs (Pinnacle closing). One row per match-market-selection.

CREATE TABLE IF NOT EXISTS historical_matches (
  id TEXT PRIMARY KEY,
  league TEXT NOT NULL,
  season TEXT NOT NULL,
  date TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  fthg INTEGER NOT NULL,
  ftag INTEGER NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_historical_matches_league_date
  ON historical_matches(league, date);
CREATE INDEX IF NOT EXISTS ix_historical_matches_season
  ON historical_matches(season);

CREATE TABLE IF NOT EXISTS historical_offers (
  match_id TEXT NOT NULL,
  market_key TEXT NOT NULL,
  selection_side TEXT NOT NULL,
  line REAL,
  decimal REAL NOT NULL,
  book TEXT NOT NULL DEFAULT 'Pinnacle',
  PRIMARY KEY (match_id, market_key, selection_side, line),
  FOREIGN KEY (match_id) REFERENCES historical_matches(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_historical_offers_market
  ON historical_offers(market_key);
