---
phase: 2
plan: 2
wave: 2
---

# Plan 2.2: Football Analytics Core

## Objective
Expand the current Poisson model to support secondary markets (Corners, Cards) using the robust data now available via FlareSolverr.

## Context
- `src-tauri/shared-lib/src/analysis.rs`
- `src-tauri/shared-lib/src/db.rs` (Schema already supports extensible stats, but we might need specific fields if `football_stats` doesn't cover them yet).

## Tasks

<task type="manual">
  <name>Data Verification</name>
  <description>Run the new Scraper (with FlareSolverr) to populate the DB with at least 50 matches to have a baseline dataset.</description>
  <done>DB has data</done>
</task>

<task type="auto">
  <name>Extend Analysis Model</name>
  <files>src-tauri/shared-lib/src/analysis.rs</files>
  <action>
    Implement `predict_corners` and `predict_cards` functions.
    - Logic: Use average corners/cards per team (Home/Away) vs League Average.
    - Output: Poisson probabilities for Over/Under markets (e.g., Over 9.5 Corners).
  </action>
  <verify>Unit tests in analysis.rs</verify>
  <done>Functions return probabilities</done>
</task>

<task type="auto">
  <name>Expose to Frontend</name>
  <files>src-tauri/app-desktop/src/main.rs</files>
  <action>
    Update `get_match_analysis` or create `get_market_analysis` to return these new probabilities.
  </action>
  <verify>Frontend receives JSON with corner/card data</verify>
  <done>API updated</done>
</task>

## Success Criteria
- [ ] Dashboard displays Corner/Card predictions.
- [ ] Predictions are based on actual scraped data.
