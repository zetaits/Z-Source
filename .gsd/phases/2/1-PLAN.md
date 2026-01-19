---
phase: 2
plan: 1
wave: 1
---

# Plan 2.1: Scraper Infrastructure Rework

## Objective
Replace direct HTTP requests with **FlareSolverr** calls to bypass Cloudflare protection on target sites.

## Context
- `src-tauri/shared-lib/src/scraper.rs` (or where the HTTP client lives)
- `src-tauri/scraper-bot/src/main.rs`

## Tasks

<task type="manual">
  <name>Setup Sidecar Binary</name>
  <description>
    1. Create `src-tauri/binaries/` folder.
    2. User must download `flaresolverr.exe` (Windows x64) and place it there as `flaresolverr-x86_64-pc-windows-msvc.exe`.
  </description>
  <done>Binary exists in correct path</done>
</task>

<task type="auto">
  <name>Configure Tauri Sidecar</name>
  <files>src-tauri/tauri.conf.json</files>
  <action>
    Add `flaresolverr` to `bundle > externalBin`.
    Add shell permission to allow spawning it.
  </action>
  <verify>Tauri build check</verify>
  <done>Config updated</done>
</task>

<task type="auto">
  <name>Spawn Sidecar on Launch</name>
  <files>src-tauri/app-desktop/src/main.rs</files>
  <action>
    Use `Command::new_sidecar("flaresolverr")` to spawn the process on app startup.
    Store the child process handle to ensure it lives/dies with the app.
  </action>
  <verify>Run app, see FlareSolverr console output in terminal</verify>
  <done>Sidecar runs automatically</done>
</task>

<task type="auto">
  <name>Create FlareSolverr Client</name>
  <files>src-tauri/shared-lib/src/fare_solverr.rs</files>
  <action>
    Implement a `FlareSolverrClient` struct or helper function.
    - URL defaults to `http://localhost:8191/v1` (FlareSolverr default).
    - Payload: `{ "cmd": "request.get", "url": target_url, "maxTimeout": 60000 }`
  </action>
  <verify>Cargo check</verify>
  <done>Helper function exists</done>
</task>

<task type="auto">
  <name>Integrate into Scraper</name>
  <files>src-tauri/shared-lib/src/fixtures.rs, src-tauri/shared-lib/src/match_stats.rs, src-tauri/shared-lib/src/team_schedule.rs</files>
  <action>
    Replace existing `reqwest::get()` or `scraper::Html::parse_document(&text)` logic with the new FlareSolverr helper.
    - Ensure graceful failure (if FlareSolverr offline, prompt user).
  </action>
  <verify>Run scraper-bot against a test match URL</verify>
  <done>Scraper retrieves HTML via FlareSolverr</done>
</task>

## Success Criteria
- [ ] Scraper-bot retrieves HTML from FBref without hanging or 403.
- [ ] Data is correctly parsed from the FlareSolverr response.
