-- Migration 003: splits_cache
-- Local cache for scraped splits to avoid re-hitting SBR / Action Network per analysis.

CREATE TABLE IF NOT EXISTS splits_cache (
  match_id TEXT NOT NULL,
  market_key TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  PRIMARY KEY (match_id, market_key, provider_id)
);

CREATE INDEX IF NOT EXISTS ix_splits_match ON splits_cache(match_id, fetched_at);
