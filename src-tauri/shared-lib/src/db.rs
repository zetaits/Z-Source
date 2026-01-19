use serde::{Deserialize, Serialize};
use rusqlite::{params, Connection, Result, Transaction, OptionalExtension};

// --- DTOs (scraped data structures) ---
#[derive(Serialize, Deserialize, Debug)]
pub struct FootballMatchStats {
    pub context: MatchContext,
    pub home_stats: TeamStats,
    pub away_stats: TeamStats,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct MatchContext {
    pub referee: String,
    pub venue: String,
    pub attendance: Option<u32>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct TeamStats {
    pub name: String, // Added field
    // General
    pub xg: f32,
    pub xga: f32,
    pub possession: f32,
    // Offensive
    pub shots: u32,
    pub shots_on_target: u32,
    pub goals: u32,
    // Creation
    pub sca: u32,
    pub gca: u32,
    // Passing
    pub passes_completed: u32,
    pub passes_progressive: u32,
    pub passes_final_third: u32,
    pub key_passes: u32,
    // Defense
    pub tackles_won: u32,
    pub interceptions: u32,
    pub blocks: u32,
    pub clearances: u32,
    // Aerial
    pub aerials_won: u32,
    pub aerials_lost: u32,
    // Goalkeeping
    pub saves: u32,
    pub psxg: f32,
    // Discipline
    pub fouls: u32,
    pub yellow_cards: u32,
    pub red_cards: u32,
    // Set Pieces
    pub corners: u32,
    // Players
    pub players: Vec<PlayerStats>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct PlayerStats {
    pub name: String,
    pub position: String,
    pub minutes: u32,
    pub goals: u32, // Added
    pub assists: u32, // Added
    pub shots: u32,
    pub shots_on_target: u32,
    pub xg: f32,
    pub xa: f32,
    pub sca: u32,
    pub touches_att_pen: u32,
    pub progressive_carries: u32,
    pub tackles: u32,
    pub interceptions: u32,
    pub fouls_committed: u32,
    pub fouls_drawn: u32,
}

// --- Database Logic ---

pub fn init_db(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS sports (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL
        );
        INSERT OR IGNORE INTO sports VALUES ('football', 'Football');

        CREATE TABLE IF NOT EXISTS teams (
            id INTEGER PRIMARY KEY,
            sport_id TEXT DEFAULT 'football' REFERENCES sports(id),
            name TEXT NOT NULL,
            url TEXT,
            UNIQUE(sport_id, name)
        );

        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY,
            sport_id TEXT NOT NULL REFERENCES sports(id),
            date TEXT NOT NULL,
            time TEXT,
            venue TEXT,
            url TEXT UNIQUE,
            status TEXT, -- 'SCHEDULED', 'FINISHED'
            home_team_id INTEGER NOT NULL REFERENCES teams(id),
            away_team_id INTEGER NOT NULL REFERENCES teams(id)
        );

        CREATE TABLE IF NOT EXISTS football_stats (
            event_id INTEGER PRIMARY KEY REFERENCES events(id),
            home_score INTEGER,
            away_score INTEGER,
            xg_home REAL,
            xg_away REAL,
            referee TEXT
        );

        CREATE TABLE IF NOT EXISTS players (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS player_match_stats (
            id INTEGER PRIMARY KEY,
            player_id INTEGER NOT NULL REFERENCES players(id),
            match_id INTEGER NOT NULL REFERENCES events(id),
            team_id INTEGER NOT NULL REFERENCES teams(id),
            
            position TEXT,
            minutes INTEGER,
            goals INTEGER,
            assists INTEGER,
            shots INTEGER,
            shots_on_target INTEGER,
            xg REAL,
            xa REAL,
            sca INTEGER,
            tackles INTEGER,
            interceptions INTEGER,
            fouls_committed INTEGER,
            fouls_drawn INTEGER
        );
        "#
    )?;

    // Migration Check: If 'matches' exists, migrate data
    let table_exists: bool = conn.query_row(
        "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='matches'",
        [],
        |row| row.get(0)
    ).unwrap_or(false);

    if table_exists {
        println!(">>> [DB] Migrating legacy 'matches' to 'events' + 'football_stats'...");
        conn.execute_batch(r#"
            INSERT OR IGNORE INTO events (id, sport_id, date, time, venue, url, status, home_team_id, away_team_id)
            SELECT 
                id, 'football', date, time, venue, url, 
                CASE WHEN home_score IS NOT NULL THEN 'FINISHED' ELSE 'SCHEDULED' END,
                home_team_id, away_team_id
            FROM matches;

            INSERT OR IGNORE INTO football_stats (event_id, home_score, away_score, xg_home, xg_away, referee)
            SELECT id, home_score, away_score, xg_home, xg_away, referee
            FROM matches;

            ALTER TABLE matches RENAME TO _matches_v1_backup;
        "#)?;
        println!(">>> [DB] Migration complete.");
    }

    Ok(())
}

fn get_or_insert_team(tx: &Transaction, name: &str) -> Result<i64> {
    upsert_team(tx, name, None)
}

fn get_or_insert_player(tx: &Transaction, name: &str) -> Result<i64> {
    let mut stmt = tx.prepare("SELECT id FROM players WHERE name = ?1")?;
    let mut rows = stmt.query(params![name])?;
    if let Some(row) = rows.next()? {
        return Ok(row.get(0)?);
    }
    tx.execute("INSERT INTO players (name) VALUES (?1)", params![name])?;
    Ok(tx.last_insert_rowid())
}

pub fn save_match_complete(conn: &mut Connection, stats: &FootballMatchStats, date: &str, url: &str) -> Result<()> {
    let tx = conn.transaction()?;

    // 1. Check Idempotency (Full Update Rule: If exists, we might want to update it if it was just a fixture)
    // But for "save_match_complete" (which is detailed stats), we strictly want to save if not fully present.
    // If it exists as a fixture (score is NULL), we UPDATE it.
    // If it exists as a match (score NOT NULL), we skip (already scraped).
    let existing_id: Option<i64> = tx.query_row(
        "SELECT id FROM matches WHERE url = ?1",
        params![url],
        |row| row.get(0)
    ).optional()?;

    // 2. Resolve Teams
    let home_id = get_or_insert_team(&tx, &stats.home_stats.name)?;
    let away_id = get_or_insert_team(&tx, &stats.away_stats.name)?;

    if let Some(id) = existing_id {
        // Check if it's already completed (has scores) - wait, querying to check score
        let has_score: bool = tx.query_row(
            "SELECT home_score IS NOT NULL FROM matches WHERE id = ?1",
            params![id],
            |row| row.get(0)
        )?;
        
        if has_score {
             return Ok(()); // Already done
        } else {
            // Update existing fixture to full match
            tx.execute(
                r#"
                UPDATE matches SET 
                    date = ?1, home_team_id = ?2, away_team_id = ?3,
                    home_score = ?4, away_score = ?5, xg_home = ?6, xg_away = ?7,
                    referee = ?8, venue = ?9
                WHERE id = ?10
                "#,
                params![
                    date, home_id, away_id,
                    stats.home_stats.goals, stats.away_stats.goals,
                    stats.home_stats.xg, stats.away_stats.xg,
                    stats.context.referee, stats.context.venue,
                    id
                ]
            )?;
            // Continue to save players...
            let match_id = id;
            save_team_players(&tx, match_id, home_id, &stats.home_stats.players)?;
            save_team_players(&tx, match_id, away_id, &stats.away_stats.players)?;
            tx.commit()?;
            return Ok(());
        }
    }

    // 3. Insert New Match
    tx.execute(
        r#"
        INSERT INTO matches (
            date, home_team_id, away_team_id, 
            home_score, away_score, xg_home, xg_away,
            referee, venue, url
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
        "#,
        params![
            date,
            home_id,
            away_id,
            stats.home_stats.goals,
            stats.away_stats.goals,
            stats.home_stats.xg,
            stats.away_stats.xg,
            stats.context.referee,
            stats.context.venue,
            url
        ],
    )?;
    let match_id = tx.last_insert_rowid();

    // 4. Save Players (Home)
    save_team_players(&tx, match_id, home_id, &stats.home_stats.players)?;

    // 5. Save Players (Away)
    save_team_players(&tx, match_id, away_id, &stats.away_stats.players)?;

    tx.commit()?;
    Ok(())
}

fn upsert_team(tx: &Transaction, name: &str, url: Option<&str>) -> Result<i64> {
    let mut stmt = tx.prepare("SELECT id FROM teams WHERE name = ?1")?;
    let mut rows = stmt.query(params![name])?;
    
    if let Some(row) = rows.next()? {
        let id: i64 = row.get(0)?;
        // Update URL if provided
        if let Some(u) = url {
            tx.execute("UPDATE teams SET url = ?1 WHERE id = ?2", params![u, id])?;
        }
        return Ok(id);
    }
    
    // Insert new
    tx.execute("INSERT INTO teams (name, url) VALUES (?1, ?2)", params![name, url])?;
    Ok(tx.last_insert_rowid())
}

pub fn save_fixture(conn: &mut Connection, home_team: &str, away_team: &str, date: &str, url: &str, venue: &str, time: &str, home_url: &str, away_url: &str) -> Result<()> {
    let tx = conn.transaction()?;
    
    // 1. Resolve Teams (and save URLs)
    let home_id = upsert_team(&tx, home_team, Some(home_url))?;
    let away_id = upsert_team(&tx, away_team, Some(away_url))?;

    // 2. Check Upsert
    let existing_id: Option<i64> = tx.query_row(
        "SELECT id FROM matches WHERE url = ?1",
        params![url],
        |row| row.get(0)
    ).optional()?;

    if let Some(id) = existing_id {
        // Found: Update date, venue, time if needed
       tx.execute(
           "UPDATE matches SET date = ?1, venue = ?2, time = ?3 WHERE id = ?4 AND home_score IS NULL",
           params![date, venue, time, id]
       )?;
    } else {
        // Insert new fixture (Scores NULL)
        tx.execute(
            r#"
            INSERT INTO matches (
                date, home_team_id, away_team_id, 
                home_score, away_score, xg_home, xg_away,
                referee, venue, time, url
            ) VALUES (?1, ?2, ?3, NULL, NULL, NULL, NULL, NULL, ?4, ?5, ?6)
            "#,
            params![date, home_id, away_id, venue, time, url]
        )?;
    }
    
    tx.commit()?;
    Ok(())
}

fn save_team_players(tx: &Transaction, match_id: i64, team_id: i64, players: &[PlayerStats]) -> Result<()> {
    let mut stmt_insert_stats = tx.prepare(
        r#"
        INSERT INTO player_match_stats (
            player_id, match_id, team_id,
            position, minutes, goals, assists, shots, shots_on_target,
            xg, xa, sca, tackles, interceptions, fouls_committed, fouls_drawn
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
        "#
    )?;

    for p in players {
        let player_id = get_or_insert_player(tx, &p.name)?;
        
        // Note: goals/assists are not explicitly in PlayerStats struct shown in logs?
        // Ah, looking at match_stats.rs, they ARE in PartialPlayerStats, but were they mapped to PlayerStats?
        // Let's verify PlayerStats struct above. It DOES NOT have goals/assists explicitly visible in the simplified struct 
        // I wrote in Step 990? NO, Step 990 `PlayerStats` has many fields but NOT goals/assists.
        // Wait, `match_stats.rs` defines `PlayerStats` too? No, it imports from `shared_lib::db`.
        // The previous `shared_lib::db::PlayerStats` (Step 990) did NOT have `goals` or `assists`.
        // It had `xg`, `shots`, `sca` etc.
        // BUT the `PartialPlayerStats` in `match_stats.rs` HAS `goals`, `assists`.
        // I should Add `goals`, `assists` to `PlayerStats` struct in `db.rs` to persist them!
        // I will add them now in the struct definition above.
        
        // Wait, I can't re-edit the file content I just prepared in the `CodeContent` block.
        // Implementation below assumes they might be missing or need to be added.
        // I will Add `pub goals: u32` and `pub assists: u32` to the struct definition in this very Write call.
        // And use them in the insert.
        
        stmt_insert_stats.execute(params![
            player_id,
            match_id,
            team_id,
            p.position,
            p.minutes,
            p.goals,
            p.assists,
            p.shots,
            p.shots_on_target,
            p.xg,
            p.xa,
            p.sca,
            p.tackles,
            p.interceptions,
            p.fouls_committed,
            p.fouls_drawn
        ])?;
    }
    Ok(())
}
