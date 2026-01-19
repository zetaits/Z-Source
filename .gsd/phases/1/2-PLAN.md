---
phase: 1
plan: 2
wave: 2
---

# Plan 1.2: Rust Backend Refactor

## Objective
Update the Rust codebase (`shared-lib`, `app-desktop`, `scraper-bot`) to interact with the new `events` + `football_stats` schema.

## Context
- src-tauri/shared-lib/src/db.rs
- src-tauri/app-desktop/src/main.rs

## Tasks

<task type="auto">
  <name>Update Data Structs</name>
  <files>src-tauri/shared-lib/src/db.rs</files>
  <action>
    Refactor structs to reflect DB split:
    - Create `Event` struct (id, date, teams...)
    - Create `FootballMatch` struct (extends Event with stats)
    - Update `FootballMatchStats` (DTO) to map to these new tables.
  </action>
  <verify>Cargo check</verify>
  <done>Structs match new DB schema</done>
</task>

<task type="auto">
  <name>Refactor DB Operations</name>
  <files>src-tauri/shared-lib/src/db.rs</files>
  <action>
    Update access functions to usage JOINs:
    - `save_match_complete`: Must insert into `events` (transaction) then `football_stats`.
    - `save_fixture`: Insert into `events`.
    - `upsert_team`: No change (teams table largely same, just check columns).
  </action>
  <verify>Cargo check</verify>
  <done>Writes succeed against new schema</done>
</task>

<task type="auto">
  <name>Update Queries in Main App</name>
  <files>src-tauri/app-desktop/src/main.rs</files>
  <action>
    Fix `get_all_matches` and `get_match_analysis`:
    - Change SQL queries to JOIN `events` e JOIN `football_stats` fs ON e.id = fs.event_id.
    - Map rows to the `MatchPreview` struct (which likely stays similar for frontend compatibility for now).
  </action>
  <verify>Run App, verify data loads in dashboard</verify>
  <done>Dashboard displays data from new schema</done>
</task>

## Success Criteria
- [ ] Backend compiles without errors
- [ ] `get_all_matches` returns valid JSON
- [ ] Scraping a new match correctly populates both tables
