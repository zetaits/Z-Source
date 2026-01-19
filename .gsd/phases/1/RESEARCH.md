# Research: Polymorphic Database Design for Z-Source

> **Phase**: 1
> **Topic**: Database Schema & Rust Architecture for Multi-Sport Support

## Context
We need to refactor the current Football-only architecture to support future sports (Basketball, Tennis, etc.). 
Current Schema: `matches` (mix of event info and football stats like `home_score`, `xg_home`).
Goal: Scalable schema that separates "Event Data" (Who, When, Where) from "Sport Stats" (Goals vs Points vs Sets).

## Options Analysis

### Option A: Single Table with Nullable Columns (The "Fat" Table)
Add `home_points`, `home_sets`, `sport_type` to `matches`.
- **Pros**: Simple queries, no joins.
- **Cons**: Extremely sparse table, hard to maintain, adding a sport requires altering the main table.
- **Verdict**: Rejected (Scalability nightmare).

### Option B: JSONB / JSON Column (The "NoSQL" Approach)
`matches` table has `stats` column (TEXT/JSON) storing sport-specific data.
- **Pros**: Flexible, no schema migration for new sports.
- **Cons**: Loss of strict typing in SQL, complex queries for analytics (e.g., "Avg XG" requires JSON extraction functions which are slower/complex in SQLite).
- **Verdict**: Rejected for Core Stats (We need deep analytics on these fields). Good for metadata.

### Option C: Class Table Inheritance (Core + Extensions)
Table `events` (id, date, sport_id, participants...)
Table `football_events` (event_id, home_score, away_score, xg...)
Table `basketball_events` (event_id, home_points, away_points...)
- **Pros**: Clean normalized schema, strictly typed, efficient analytics per sport.
- **Cons**: Requires JOINS, slightly more complex writes (Tx required).
- **Verdict**: **SELECTED**. Best balance of structure and performance for a "Terminal" app.

## Proposed Schema (SQLite)

```sql
CREATE TABLE sports (
    id TEXT PRIMARY KEY, -- 'football', 'basketball'
    name TEXT NOT NULL
);

CREATE TABLE teams (
    id INTEGER PRIMARY KEY,
    sport_id TEXT REFERENCES sports(id),
    name TEXT NOT NULL,
    url TEXT -- External reference
);

CREATE TABLE events (
    id INTEGER PRIMARY KEY,
    sport_id TEXT REFERENCES sports(id),
    date TEXT NOT NULL,
    time TEXT,
    venue TEXT,
    url TEXT UNIQUE, -- Source URL
    status TEXT -- 'SCHEDULED', 'FINISHED'
);

CREATE TABLE event_participants (
    event_id INTEGER REFERENCES events(id),
    team_id INTEGER REFERENCES teams(id),
    is_home BOOLEAN,
    PRIMARY KEY (event_id, team_id)
);

-- Extension: Football
CREATE TABLE football_stats (
    event_id INTEGER PRIMARY KEY REFERENCES events(id),
    home_score INTEGER,
    away_score INTEGER,
    xg_home REAL,
    xg_away REAL
    -- ... other core football stats
);
```

**Note**: For `event_participants`, simplification: standard `home_team_id` / `away_team_id` on `events` is acceptable if we assume 2-team sports for MVP. 
*Correction*: Tennis is 1v1 (Players), Football 11v11 (Teams). 
Decision: Keep `home_team_id` / `away_team_id` on `events` but rename slightly or map generic "Participant" IDs.
For MVP (Phase 1), generic `home_id`, `away_id` referencing a `participants` table (polymorphic team/player) might be over-engineering.
*Refined Decision*: Keep `teams` table concepts for now. Tennis players can be "teams" of 1.

## Rust Architecture

- **Trait `Sport`**: Defines how to parse/display data.
- **Enum `SportType`**: Football, Basketball.
- **Struct `Event<T>`**: Generic wrapper?
  - Or `Event` struct (DB row) + `FootballDetails` struct.
  - Recommended: `Event` struct for list views. `Match<T>` for detailed views.

## Migration Strategy
1. Rename `matches` to `football_matches_legacy` (backup).
2. Create new normalized tables.
3. Migration script (Rust) to move data from legacy to new structure.
4. Drop legacy.

## Implementation Plan
1. **DB Migration**: Apply Schema C.
2. **Rust Backend**: Refactor `db.rs` to handle split reads/writes.
3. **Frontend**: Update `MatchPreview` interface to generic `EventPreview` + specific details.
