-- 004: history_cache for SofaScore-scraped team form / H2H / intangibles
-- cache_key shapes: "form:{teamId}:{lastN}" | "h2h:{homeId}:{awayId}" | "intangibles:{matchId}"

CREATE TABLE IF NOT EXISTS history_cache (
  cache_key TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_history_fetched ON history_cache(fetched_at);
