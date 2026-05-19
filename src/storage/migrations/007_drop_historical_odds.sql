-- 007: backtest feature removed; drop orphan historical_odds tables.
-- DROP IF EXISTS is safe on both existing DBs (tables present) and fresh DBs (tables already gone).

DROP INDEX IF EXISTS ix_historical_offers_market;
DROP TABLE IF EXISTS historical_offers;
DROP INDEX IF EXISTS ix_historical_matches_season;
DROP INDEX IF EXISTS ix_historical_matches_league_date;
DROP TABLE IF EXISTS historical_matches;
