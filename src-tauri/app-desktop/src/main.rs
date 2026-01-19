#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use rusqlite::Connection;
use tauri::State;
use tauri::Manager;
use shared_lib::analysis::{self, MatchPrediction};
use serde::Serialize;
use std::process::{Command, Stdio};
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

// AppState to hold the DB connection safely
struct AppState {
    db: Mutex<Connection>,
}

#[derive(Serialize)]
struct MatchPreview {
    id: i64,
    date: String,
    time: String,
    home_team: String,
    away_team: String,
    score: String,
    status: String,
    xg_home: Option<f64>,
    xg_away: Option<f64>,
    venue: Option<String>,
}

#[derive(Serialize)]
struct MatchAnalysisResult {
    match_info: MatchPreview,
    prediction: MatchPrediction,
}

#[tauri::command]
fn get_match_analysis(state: State<AppState>, match_id: i64) -> Result<MatchAnalysisResult, String> {
    let conn = state.db.lock().map_err(|_| "Failed to lock DB".to_string())?;
    
    // 1. Get Match Details (Joined from events + football_stats)
    let mut stmt = conn.prepare(r#"
        SELECT 
            e.id, e.date, h.name, a.name, 
            fs.home_score, fs.away_score, fs.xg_home, fs.xg_away,
            e.home_team_id, e.away_team_id, e.venue, e.time
        FROM events e
        LEFT JOIN football_stats fs ON e.id = fs.event_id
        JOIN teams h ON e.home_team_id = h.id
        JOIN teams a ON e.away_team_id = a.id
        WHERE e.id = ?1
    "#).map_err(|e| e.to_string())?;

    let (preview, home_id, away_id) = stmt.query_row([match_id], |row| {
        let home_score: Option<i32> = row.get(4)?;
        let away_score: Option<i32> = row.get(5)?;
        let score = match (home_score, away_score) {
            (Some(h), Some(a)) => format!("{}-{}", h, a),
            _ => "vs".to_string()
        };
        // Status: 'FINISHED' check or score presence
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
            e.id, 
            e.date, 
            h.name as home_team, 
            a.name as away_team,
            fs.home_score, 
            fs.away_score,
            fs.xg_home,
            fs.xg_away,
            e.venue,
            e.time
        FROM events e
        LEFT JOIN football_stats fs ON e.id = fs.event_id
        JOIN teams h ON e.home_team_id = h.id
        JOIN teams a ON e.away_team_id = a.id
        WHERE e.sport_id = 'football' -- Filter by sport
        ORDER BY e.date ASC
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
    
    // Migration: Ensure teams have url column (Done in init, but keeping for safety/legacy)
    // let _ = conn.execute("ALTER TABLE teams ADD COLUMN url TEXT", []); 

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
            SELECT e.url, h.url, a.url 
            FROM events e 
            JOIN teams h ON e.home_team_id = h.id 
            JOIN teams a ON e.away_team_id = a.id 
            WHERE e.id = ?1
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
    let h_url = home_url.ok_or_else(|| "Missing Home Team URL in DB. Please Sync Fixtures again.".to_string())?;
    let a_url = away_url.ok_or_else(|| "Missing Away Team URL in DB. Please Sync Fixtures again.".to_string())?;

    // 3. Scrape History for both teams
    let teams = vec![h_url, a_url];
    
    for team_url in teams {
        println!(">>> [Analysis] Processing History for: {}", team_url);
        let history_urls = shared_lib::team_schedule::get_team_match_history(&team_url).await
            .map_err(|e| format!("Failed to get history for {}: {}", team_url, e))?;

        println!(">>> [Analysis] Found {} historical matches. checking missing...", history_urls.len());
        
        for hist_url in history_urls {
            // Check if exists
            let exists: bool = {
                let conn = state.db.lock().map_err(|_| "DB Lock Error".to_string())?;
                // Check if event exists and has stats (finished)
                conn.query_row(r#"
                    SELECT 1 FROM events e 
                    JOIN football_stats fs ON e.id = fs.event_id 
                    WHERE e.url = ?1
                "#, [&hist_url], |_| Ok(true))
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
    
    // Try to locate DB
    let db_path = if cwd.join("../sports_data.db").exists() {
        "../sports_data.db"
    } else if cwd.join("sports_data.db").exists() {
        "sports_data.db"
    } else {
        println!(">>> [Main] Warning: sports_data.db not found. Defaulting to ../sports_data.db");
        "../sports_data.db"
    };

    println!(">>> [Main] Opening Database at: {}", db_path);
    let conn = Connection::open(db_path).expect("Failed to open valid sports_data.db");
    
    // Initialize DB Schema 
    println!(">>> [Main] Initializing Database Schema...");
    shared_lib::db::init_db(&conn).expect("Failed to initialize database schema");

    // Clear fixtures logic (Updated to use events table if user requested clear)
    // conn.execute("DELETE FROM events WHERE status = 'SCHEDULED'", []).ok();

    tauri::Builder::default()
        .setup(|app| {
            // Path Resolution
            let binary_name = "flaresolverr-x86_64-pc-windows-msvc.exe";
            let binary_path = if cfg!(debug_assertions) {
                // Dev: src-tauri/binaries (Relative to app-desktop means ../binaries)
                std::env::current_dir()?.join("../binaries").join(binary_name)
            } else {
                // Prod: In resources/binaries
                app.path().resource_dir()?.join("binaries").join(binary_name)
            };

            println!("[Sidecar] Launching FlareSolverr from: {:?}", binary_path);

            if !binary_path.exists() {
                 eprintln!("[Sidecar Error] Binary not found at: {:?}", binary_path);
            } else {
                let child = Command::new(&binary_path)
                    .env("HOST", "127.0.0.1")
                    .env("PORT", "8191")
                    .env("LOG_LEVEL", "info") // Info is enough usually
                    .creation_flags(CREATE_NO_WINDOW) 
                    .stdout(Stdio::inherit())
                    .stderr(Stdio::inherit())
                    .spawn();

                match child {
                    Ok(c) => {
                        println!("[Sidecar] FlareSolverr started (PID: {:?})", c.id());
                        println!("[Sidecar] Waiting 3s for startup...");
                        std::thread::sleep(std::time::Duration::from_secs(3));
                        println!("[Sidecar] Startup wait complete. Check console for FlareSolverr logs.");
                    },
                    Err(e) => eprintln!("[Sidecar Error] Failed to spawn: {}", e),
                }
            }
            Ok(())
        })
        .manage(AppState { db: Mutex::new(conn) })
        .invoke_handler(tauri::generate_handler![get_match_analysis, get_all_matches, fetch_upcoming_matches, analyze_missing_teams])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
