#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use rusqlite::Connection;
use tauri::State;
use shared_lib::analysis::{self, MatchPrediction};
use serde::Serialize;

// AppState to hold the DB connection safely
struct AppState {
    db: Mutex<Connection>,
}

#[derive(Serialize)]
struct MatchPreview {
    id: i64,
    date: String,
    time: String, // Added
    home_team: String,
    away_team: String,
    score: String,
    status: String,
    xg_home: Option<f64>,
    xg_away: Option<f64>,
    venue: Option<String>, // Added
}

#[derive(Serialize)]
struct MatchAnalysisResult {
    match_info: MatchPreview,
    prediction: MatchPrediction,
}

#[tauri::command]
fn get_match_analysis(state: State<AppState>, match_id: i64) -> Result<MatchAnalysisResult, String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock DB".to_string())?;
    
    // 1. Get Match Details
    let mut stmt = conn.prepare(r#"
        SELECT 
            m.id, m.date, h.name, a.name, m.home_score, m.away_score, m.xg_home, m.xg_away,
            m.home_team_id, m.away_team_id, m.venue, m.time
        FROM matches m
        JOIN teams h ON m.home_team_id = h.id
        JOIN teams a ON m.away_team_id = a.id
        WHERE m.id = ?1
    "#).map_err(|e| e.to_string())?;

    let (preview, home_id, away_id) = stmt.query_row([match_id], |row| {
        let home_score: Option<i32> = row.get(4)?;
        let away_score: Option<i32> = row.get(5)?;
        let score = match (home_score, away_score) {
            (Some(h), Some(a)) => format!("{}-{}", h, a),
            _ => "vs".to_string()
        };
        let status = if home_score.is_some() { "Analizado" } else { "Programado" };
        let venue: Option<String> = row.get(10).ok();
        let time: Option<String> = row.get(11).ok();

        let preview = MatchPreview {
            id: row.get(0)?,
            date: row.get(1)?,
            time: time.unwrap_or_default(),
            home_team: row.get(2)?,
            away_team: row.get(3)?,
            score,
            status: status.to_string(),
            xg_home: row.get(6)?,
            xg_away: row.get(7)?,
            venue,
        };
        let h_id: i64 = row.get(8)?;
        let a_id: i64 = row.get(9)?;
        Ok((preview, h_id, a_id))
    }).map_err(|e| format!("Match not found: {}", e))?;

    // 2. Run Analysis
    let prediction = analysis::analyze_match(&conn, home_id, away_id)
        .map_err(|e| format!("Analysis failed: {}", e))?;

    Ok(MatchAnalysisResult {
        match_info: preview,
        prediction,
    })
}

#[tauri::command]
fn get_all_matches(state: State<AppState>) -> Result<Vec<MatchPreview>, String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock DB".to_string())?;
    
    let mut stmt = conn.prepare(r#"
        SELECT 
            m.id, 
            m.date, 
            h.name as home_team, 
            a.name as away_team,
            m.home_score, 
            m.away_score,
            m.xg_home,
            m.xg_away,
            m.venue,
            m.time
        FROM matches m
        JOIN teams h ON m.home_team_id = h.id
        JOIN teams a ON m.away_team_id = a.id
        ORDER BY m.date ASC
    "#).map_err(|e| e.to_string())?;

    let match_iter = stmt.query_map([], |row| {
        let home_score: Option<i32> = row.get(4)?;
        let away_score: Option<i32> = row.get(5)?;
        let score = match (home_score, away_score) {
            (Some(h), Some(a)) => format!("{}-{}", h, a),
            _ => "vs".to_string()
        };
        let status = if home_score.is_some() { "Analizado" } else { "Programado" };
        let venue: Option<String> = row.get(8).ok();
        let time: Option<String> = row.get(9).ok();

        Ok(MatchPreview {
            id: row.get(0)?,
            date: row.get(1)?,
            time: time.unwrap_or_default(),
            home_team: row.get(2)?,
            away_team: row.get(3)?,
            score,
            status: status.to_string(),
            xg_home: row.get(6)?,
            xg_away: row.get(7)?,
            venue,
        })
    }).map_err(|e| e.to_string())?;

    let mut matches = Vec::new();
    for m in match_iter {
        matches.push(m.map_err(|e| e.to_string())?);
    }
    
    Ok(matches)
}

#[tauri::command]
async fn fetch_upcoming_matches(state: State<'_, AppState>, league_url: String) -> Result<usize, String> {
    println!(">>> [Tauri Command] fetch_upcoming_matches called with URL: {}", league_url);

    // 1. Scrape
    let fixtures = shared_lib::fixtures::scrape_fixtures(&league_url).await
        .map_err(|e| {
            println!(">>> [Tauri Command] Scrape Error: {}", e);
            format!("Scraping failed: {}", e)
        })?; 

    // 2. Save
    println!(">>> [Tauri Command] Scrape success. Saving to DB...");
    let mut conn = state.db.lock().map_err(|_| "Failed to lock DB".to_string())?;
    
    // Migration: Ensure teams have url column
    let _ = conn.execute("ALTER TABLE teams ADD COLUMN url TEXT", []); // Lazy migration

    let mut count = 0;
    
    for match_info in fixtures {
        shared_lib::db::save_fixture(
            &mut conn, 
            &match_info.home_team, 
            &match_info.away_team, 
            &match_info.date, 
            &match_info.url,
            &match_info.venue,
            &match_info.time,
            &match_info.home_url,
            &match_info.away_url
        ).map_err(|e| {
             println!(">>> [Tauri Command] DB Error saving fixture: {}", e);
             format!("DB Save failed: {}", e)
        })?;
        count += 1;
    }

    println!(">>> [Tauri Command] Sync complete. Saved/Updated {} fixtures.", count);
    Ok(count)
}

#[tauri::command]
async fn analyze_missing_teams(state: State<'_, AppState>, match_id: i64) -> Result<(), String> {
    println!(">>> [Tauri Command] analyze_missing_teams called for match_id: {}", match_id);
    
    // 1. Get Match Info & Team URLs directly from DB (Enhanced)
    let (match_url, home_url, away_url): (String, Option<String>, Option<String>) = {
        let conn = state.db.lock().map_err(|_| "Failed to lock DB".to_string())?;
        
        // Query joining teams to get their URLs
        conn.query_row(r#"
            SELECT m.url, h.url, a.url 
            FROM matches m 
            JOIN teams h ON m.home_team_id = h.id 
            JOIN teams a ON m.away_team_id = a.id 
            WHERE m.id = ?1
        "#, [match_id], |row| {
            Ok((
                row.get(0)?,
                row.get(1).ok(),
                row.get(2).ok()
            ))
        })
        .map_err(|e| format!("Match/Teams not found: {}", e))?
    };

    println!(">>> [Analysis] processing match: {}. Home URL: {:?}, Away URL: {:?}", match_url, home_url, away_url);

    // 2. Resolve Team URLs
    // If URLs are missing in DB, we try to fallback or error. 
    // Since user just synced, they should be there.
    let h_url = home_url.ok_or_else(|| "Missing Home Team URL in DB. Please Sync Fixtures again.".to_string())?;
    let a_url = away_url.ok_or_else(|| "Missing Away Team URL in DB. Please Sync Fixtures again.".to_string())?;

    // 3. Scrape History for both teams
    let teams = vec![h_url, a_url];
    
    for team_url in teams {
        println!(">>> [Analysis] Processing History for: {}", team_url);
        // ... (existing logic)
        let history_urls = shared_lib::team_schedule::get_team_match_history(&team_url).await
            .map_err(|e| format!("Failed to get history for {}: {}", team_url, e))?;

        println!(">>> [Analysis] Found {} historical matches. checking missing...", history_urls.len());
        
        for hist_url in history_urls {
            // Check if exists
            let exists: bool = {
                let conn = state.db.lock().map_err(|_| "DB Lock Error".to_string())?;
                conn.query_row("SELECT 1 FROM matches WHERE url = ?1 AND home_score IS NOT NULL", [&hist_url], |_| Ok(true))
                    .unwrap_or(false)
            };

            if exists {
                continue;
            }

            println!(">>> [Analysis] Scraping NEW Match: {}", hist_url);
            match shared_lib::match_stats::scrape_match(&hist_url).await {
                Ok(stats) => {
                   let mut conn = state.db.lock().map_err(|_| "DB Lock Error".to_string())?;
                   // Fallback date
                   shared_lib::db::save_match_complete(&mut conn, &stats, "2023-01-01", &hist_url)
                        .map_err(|e| println!("DB Save Error: {}", e)).ok();
                },
                Err(e) => {
                    println!("Failed to scrape {}: {}", hist_url, e);
                }
            }
        }
    }
    
    Ok(())
}

fn main() {
    let cwd = std::env::current_dir().unwrap_or_default();
    println!(">>> [Main] Current Working Directory: {:?}", cwd);
    
    // Try to locate DB relative to CWD
    // We expect it in src-tauri/sports_data.db
    let db_path = if cwd.join("../sports_data.db").exists() {
        // Run from app-desktop
        "../sports_data.db"
    } else if cwd.join("sports_data.db").exists() {
        // Run from src-tauri
        "sports_data.db"
    } else {
        // Fallback or potentially opening new file
        println!(">>> [Main] Warning: existing sports_data.db not found in usual relative paths. Defaulting to ../sports_data.db");
        "../sports_data.db"
    };

    println!(">>> [Main] Opening Database at: {}", db_path);
    let conn = Connection::open(db_path).expect("Failed to open valid sports_data.db");
    
    // Initialize DB Schema (Idempotent)
    println!(">>> [Main] Initializing Database Schema...");
    shared_lib::db::init_db(&conn).expect("Failed to initialize database schema");

    // Migration: Ensure time column exists (Ignore error if exists)
    let _ = conn.execute("ALTER TABLE matches ADD COLUMN time TEXT DEFAULT ''", []);

    // TEMP: Clear fixtures as requested by user (Re-enabled)
    println!(">>> [Main] Clearing existing fixtures (requested)...");
    conn.execute("DELETE FROM matches WHERE home_score IS NULL", []).expect("Failed to clear fixtures");

    
    // Quick check if schema exists
    let table_check: Result<i32, _> = conn.query_row("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='teams'", [], |r| r.get(0));
    match table_check {
        Ok(c) => println!(">>> [Main] DB Check: Found 'teams' table? {}", c > 0),
        Err(e) => println!(">>> [Main] DB Check Error: {}", e),
    }

    tauri::Builder::default()
        .manage(AppState { db: Mutex::new(conn) })
        .invoke_handler(tauri::generate_handler![get_match_analysis, get_all_matches, fetch_upcoming_matches, analyze_missing_teams])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
