---
phase: 1
plan: 1
wave: 1
---

# Plan 1.1: Database Refactor (Polymorphism)

## Objective
Migrate the SQLite database from a monolithic `matches` table to a normalized polymorphic structure (`events` + `football_stats`) to allow future additions of other sports without breaking the schema.

## Context
- .gsd/phases/1/RESEARCH.md
- src-tauri/shared-lib/src/db.rs

## Tasks

<task type="auto">
  <name>Create New Schema Definitions</name>
  <files>src-tauri/shared-lib/src/db.rs</files>
  <action>
    Update `init_db` function to create the new tables:
    - `sports` (id, name)
    - `events` (id, sport_id, date, time, venue, url, status, home_id, away_id)
    - `football_stats` (event_id, home_score, away_score, xg_home, xg_away, referee)
    
    *Strict Order*: Create new tables IF NOT EXISTS.
    Include `INSERT OR IGNORE INTO sports VALUES ('football', 'Football')`.
  </action>
  <verify>Run backend, invoke check of sqlite_master</verify>
  <done>New tables exist in sports_data.db</done>
</task>

<task type="auto">
  <name>Migrate Data & Deprecate Legacy</name>
  <files>src-tauri/shared-lib/src/db.rs</files>
  <action>
    Implement a one-time migration function `migrate_v1_to_v2`:
    1. Check if `matches` table exists.
    2. Read all rows from `matches`.
    3. Insert into `events` (mapping columns).
    4. Insert into `football_stats` (using last_insert_rowid from events).
    5. Rename `matches` to `_matches_v1_backup` to safely deprecate it.
  </action>
  <verify>Run migration, check that `events` count equals old `matches` count</verify>
  <done>Data preserved in new structure</done>
</task>

## Success Criteria
- [ ] `events` table contains all scheduling/meta data
- [ ] `football_stats` contains scoring data
- [ ] Legacy `matches` table is removed or renamed
- [ ] Application compiles (Note: This will temporarily break queries until Plan 1.2)
