-- Migration 002: multi-provider support
-- (a) match_resolution becomes per-(catalog_source, catalog_id, odds_provider_id)
-- (b) providers_quota persists last-known quota snapshot per OddsProvider

CREATE TABLE IF NOT EXISTS match_resolution_v2 (
  catalog_source TEXT NOT NULL,
  catalog_id TEXT NOT NULL,
  odds_provider_id TEXT NOT NULL,
  odds_event_id TEXT,
  resolved_at TEXT NOT NULL,
  confidence REAL NOT NULL,
  PRIMARY KEY (catalog_source, catalog_id, odds_provider_id)
);

INSERT OR IGNORE INTO match_resolution_v2
  (catalog_source, catalog_id, odds_provider_id, odds_event_id, resolved_at, confidence)
SELECT catalog_source, catalog_id, 'the-odds-api', odds_event_id, resolved_at, confidence
FROM match_resolution;

DROP TABLE match_resolution;
ALTER TABLE match_resolution_v2 RENAME TO match_resolution;

CREATE TABLE IF NOT EXISTS providers_quota (
  provider_id TEXT PRIMARY KEY,
  remaining INTEGER,
  used INTEGER,
  capacity INTEGER,
  reset_at TEXT,
  last_synced_at TEXT NOT NULL
);
