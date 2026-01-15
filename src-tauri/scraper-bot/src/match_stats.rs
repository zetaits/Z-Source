use anyhow::{Context, Result};
use headless_chrome::{Browser, LaunchOptions};
use regex::Regex;
use scraper::{Html, Selector};
use shared_lib::db::{FootballMatchStats, MatchContext, PlayerStats, TeamStats};
use std::collections::HashMap;
use std::fs;
use std::ffi::OsStr; 
use std::{thread, time::Duration};

#[derive(Debug, Default, Clone)]
struct PartialPlayerStats {
    name: String,
    position: String,
    minutes: u32,
    
    // Summary
    xg: f32,
    shots: u32,
    shots_on_target: u32,
    goals: u32,
    assists: u32,
    
    // Passing
    passes_completed: u32,
    progressive_passes: u32,
    passes_final_third: u32,
    passes_penalty_area: u32,
    key_passes: u32,
    
    // Pass Types
    corners: u32,
        
    // Defense
    tackles_won: u32,
    interceptions: u32,
    blocks: u32,
    clearances: u32,
    
    // Misc
    yellow_cards: u32,
    red_cards: u32,
    fouls_committed: u32,
    fouls_drawn: u32,
    aerials_won: u32,
    aerials_lost: u32,
    
    // Calculated
    sca: u32,
    gca: u32,
    touches_att_pen: u32,
    progressive_carries: u32,
    xa: f32, // expected assists
}

// Key for HashMap: (TeamName, PlayerName)
type PlayerMap = HashMap<(String, String), PartialPlayerStats>;

pub async fn scrape_match(url: &str) -> Result<FootballMatchStats> {
    println!("Scraping match details: {}", url);
    
    // 1. Launch Browser (VISIBLE for Debugging/Xvfb)
    let launch_options = LaunchOptions {
        window_size: Some((1920, 1080)),
        headless: false, // VISIBLE
        enable_gpu: false, 
        args: vec![
            OsStr::new("--disable-blink-features=AutomationControlled"),
            OsStr::new("--start-maximized"),
            OsStr::new("--no-sandbox"), 
            OsStr::new("--disable-dev-shm-usage"),
            OsStr::new("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
        ],
        ..Default::default()
    };
    let browser = Browser::new(launch_options).context("Failed to launch browser")?;
    let tab = browser.new_tab().context("Failed to create tab")?;

    // 2. Navigate
    println!("Navigating to: {}", url);
    tab.navigate_to(url)?; 

    // 3. Polling Loop (Cloudflare Wait)
    let mut found = false;
    let max_attempts = 15; // 15 * 2s = 30s timeout
    
    for attempt in 1..=max_attempts {
        println!("Polling for .scorebox (Attempt {}/{}) - Waiting for Cloudflare...", attempt, max_attempts);
        
        // Sleep first to give time for render/redirect
        thread::sleep(Duration::from_secs(2));

        // Check if element exists (Instant check, no blocked wait)
        match tab.find_element(".scorebox") {
            Ok(_) => {
                println!("Target element .scorebox found! Cloudflare passed.");
                found = true;
                break;
            },
            Err(_) => {
                // Not found yet, continue polling
            }
        }
    }

    // Post-Loop Validation
    if !found {
        println!("Timeout: .scorebox not found after loop.");
        // Optional: Dump HTML to see what happened
        if let Ok(elem) = tab.find_element("html") {
            if let Ok(html_dump) = elem.get_content() {
                let _ = fs::write("debug_timeout.html", html_dump);
            }
        }
        return Err(anyhow::anyhow!("Timeout waiting for match data (.scorebox not found)"));
    }

    // 4. Extraction (Critical: No more waits, just grab HTML)
    let raw_html = tab.find_element("html")
        .context("Failed to get HTML element after passing check")?
        .get_content()
        .context("Failed to extract HTML content")?;
        
    println!("[DEBUG] Raw HTML length: {}", raw_html.len());

    // 3. De-commenter (Regex)
    let re = Regex::new(r"<!--|-->").unwrap();
    let clean_html = re.replace_all(&raw_html, "").to_string();
    let document = Html::parse_document(&clean_html);

    // 4. Extract Metadata (Keyword Search)
    let meta_rows_sel = Selector::parse("div.scorebox_meta > div").unwrap();
    let mut venue = String::new();
    let mut referee = String::new();
    let mut attendance = None;

    for row in document.select(&meta_rows_sel) {
        let text = row.text().collect::<Vec<_>>().join(" ");
        if text.contains("Venue") {
            // Usually "Venue: Name" or similar structure, often value is in a following text node or span
            // Splitting by ':' might be simplistic but works for "Venue: ...". 
            // Better: find the part after "Venue"
            venue = text.replace("Venue", "").replace(":", "").trim().to_string();
        } else if text.contains("Attendance") {
            let num_str = text.replace("Attendance", "").replace(":", "").replace(",", "").trim().to_string();
            attendance = num_str.parse::<u32>().ok();
        } else if text.contains("Referee") || text.contains("Official") {
             referee = text.replace("Referee", "").replace("Officials", "").replace(":", "").replace("(Referee)", "").trim().to_string();
        }
    }

    // Validate Scorebox
    let team_selector = Selector::parse("div.scorebox div[itemprop='performer'] a").unwrap();
    let mut team_names = Vec::new();
    for el in document.select(&team_selector) {
        team_names.push(el.inner_html().trim().to_string());
    }

    if team_names.len() < 2 {
        println!("[DEBUG] Scorebox Validation Failed: Could not find team names. Possible soft block.");
    } else {
        println!("[DEBUG] Scorebox found teams: {:?}", team_names);
    }

    let home_team_name = team_names.get(0).cloned().unwrap_or("Home".to_string());
    let away_team_name = team_names.get(1).cloned().unwrap_or("Away".to_string());

    let context = MatchContext {
        referee,
        venue,
        attendance,
    };

    // 4. Parse Tables & Aggregate Player Stats
    // STRICT SEPARATION: 1st table = Home, 2nd table = Away for each category
    let mut home_player_map: PlayerMap = HashMap::new();
    let mut away_player_map: PlayerMap = HashMap::new();

    // Stats categories to parse
    let categories = vec![
        ("summary", process_summary_row as fn(&scraper::ElementRef, &mut PartialPlayerStats)),
        ("passing", process_passing_row),
        ("passing_types", process_pass_types_row),
        ("defense", process_defense_row),
        ("misc", process_misc_row),
        ("gca", process_gca_row),
    ];

    for (keyword, processor) in categories {
        // Find all tables matching keyword (id contains keyword)
        // CRITICAL FIX: Ensure "passing" does not match "passing_types" to keep table order Home/Away valid
        let tables: Vec<_> = document.select(&Selector::parse("table").unwrap())
            .filter(|t| {
                let id = t.value().id().unwrap_or("");
                if !id.contains(keyword) {
                    return false;
                }
                // Disambiguation
                if keyword == "passing" && id.contains("passing_types") {
                    return false;
                }
                true
            })
            .collect();

        if tables.len() >= 2 {
            // First table -> Home
            process_single_table(&tables[0], &mut home_player_map, processor);
            // Second table -> Away
            process_single_table(&tables[1], &mut away_player_map, processor);
        } else {
             println!("[DEBUG] Warning: Found {} tables for keyword '{}' (expected >= 2)", tables.len(), keyword);
        }
    }

    println!("[DEBUG] Home Players extracted: {}", home_player_map.len());
    println!("[DEBUG] Away Players extracted: {}", away_player_map.len());

    // 5. Build Team Stats from Aggregated Player Stats
    let home_stats = build_team_stats_from_map(&home_player_map, &home_team_name);
    let away_stats = build_team_stats_from_map(&away_player_map, &away_team_name);

    // 6. Security Dump Check
    if home_stats.players.is_empty() && away_stats.players.is_empty() {
        println!("⚠️ WARNING: No players found! Dumping HTML to 'debug_error.html'...");
        fs::write("debug_error.html", &clean_html).context("Failed to write debug dump")?;
    }

    Ok(FootballMatchStats {
        context,
        home_stats,
        away_stats,
    })
}

// --- Helpers ---

fn get_meta_text(doc: &Html, selector: &str) -> String {
    let sel = Selector::parse(selector).unwrap();
    if let Some(el) = doc.select(&sel).next() {
        el.inner_html().trim().to_string()
    } else {
        String::new()
    }
}

// Process a SPECIFIC table element into a specific map
fn process_single_table<F>(
    table: &scraper::ElementRef, 
    map: &mut PlayerMap, 
    row_handler: F
) 
where F: Fn(&scraper::ElementRef, &mut PartialPlayerStats) 
{
    let row_sel = Selector::parse("tbody tr").unwrap();
    let player_sel = Selector::parse("th[data-stat='player'] a").unwrap();

    for row in table.select(&row_sel) {
        // Check for "thead" class securely (header repetition in long tables)
        if row.value().attr("class").map_or(false, |c| c.contains("thead")) { continue; }
        
        if let Some(player_link) = row.select(&player_sel).next() {
            let player_name = player_link.inner_html().trim().to_string();
            
            // Map key is just player name now since maps are separate
            // But strict requirement uses (Team, Player) key? 
            // Actually, we can just use PlayerName as key for the scoped map, 
            // but the Type definition requires (String, String). 
            // We'll use a dummy team name "" or handle it.
            // Let's change PlayerMap to HashMap<String, PartialPlayerStats> for simplicity inside the function scope?
            // Refactor: Let's stick to the existing type alias PlayerMap = HashMap<(String, String), PartialPlayerStats>
            // We'll use a placeholder "Key" part or just use the name.
            
            let key = ("".to_string(), player_name.clone());
            let stats = map.entry(key).or_insert_with(|| PartialPlayerStats {
                name: player_name,
                position: "N/A".to_string(), 
                ..Default::default()
            });
            
            if stats.position == "N/A" {
                 if let Some(pos_cell) = select_stat(&row, "position") {
                     stats.position = pos_cell.inner_html().trim().to_string();
                 }
             }
             if stats.minutes == 0 {
                 stats.minutes = parse_u32(&row, "minutes");
             }

            row_handler(&row, stats);
        }
    }
}

// Row Handlers
fn process_summary_row(row: &scraper::ElementRef, stats: &mut PartialPlayerStats) {
    stats.xg = parse_f32(row, "xg");
    stats.shots = parse_u32(row, "shots");
    stats.shots_on_target = parse_u32(row, "shots_on_target");
    stats.goals = parse_u32(row, "goals");
    stats.assists = parse_u32(row, "assists");
    stats.sca = parse_u32(row, "sca");
    stats.gca = parse_u32(row, "gca");
}

fn process_passing_row(row: &scraper::ElementRef, stats: &mut PartialPlayerStats) {
    stats.passes_completed = parse_u32(row, "passes_completed");
    stats.progressive_passes = parse_u32(row, "progressive_passes");
    stats.passes_final_third = parse_u32(row, "passes_into_final_third");
    stats.passes_penalty_area = parse_u32(row, "passes_into_penalty_area");
    stats.key_passes = parse_u32(row, "passes_key");
    if stats.xa == 0.0 { stats.xa = parse_f32(row, "xg_assist"); }
}

fn process_pass_types_row(row: &scraper::ElementRef, stats: &mut PartialPlayerStats) {
    stats.corners = parse_u32(row, "corner_kicks");
}

fn process_defense_row(row: &scraper::ElementRef, stats: &mut PartialPlayerStats) {
    stats.tackles_won = parse_u32(row, "tackles_won");
    stats.interceptions = parse_u32(row, "interceptions");
    stats.blocks = parse_u32(row, "blocks");
    stats.clearances = parse_u32(row, "clearances");
}

fn process_misc_row(row: &scraper::ElementRef, stats: &mut PartialPlayerStats) {
    stats.yellow_cards = parse_u32(row, "cards_yellow");
    stats.red_cards = parse_u32(row, "cards_red");
    stats.fouls_committed = parse_u32(row, "fouls");
    stats.fouls_drawn = parse_u32(row, "fouls_drawn");
    stats.aerials_won = parse_u32(row, "aerials_won");
    stats.aerials_lost = parse_u32(row, "aerials_lost");
}

fn process_gca_row(_row: &scraper::ElementRef, _stats: &mut PartialPlayerStats) {
    // Placeholder
}

// Value Parsers
fn select_stat<'a>(row: &'a scraper::ElementRef, stat: &str) -> Option<scraper::ElementRef<'a>> {
    let sel = Selector::parse(&format!("[data-stat='{}']", stat)).unwrap();
    row.select(&sel).next()
}

fn parse_u32(row: &scraper::ElementRef, stat: &str) -> u32 {
    select_stat(row, stat)
        .map(|el| el.text().collect::<String>().replace(",", "").trim().parse().unwrap_or(0))
        .unwrap_or(0)
}

fn parse_f32(row: &scraper::ElementRef, stat: &str) -> f32 {
     select_stat(row, stat)
        .map(|el| el.text().collect::<String>().replace(",", "").trim().parse().unwrap_or(0.0))
        .unwrap_or(0.0)
}

fn build_team_stats_from_map(map: &PlayerMap, team_name: &str) -> TeamStats {
    let team_players: Vec<&PartialPlayerStats> = map.values().collect();

    TeamStats {
        name: team_name.to_string(), // Added
        possession: 0.0, 
        xg: team_players.iter().map(|p| p.xg).sum(),
        xga: 0.0,
        shots: team_players.iter().map(|p| p.shots).sum(),
        shots_on_target: team_players.iter().map(|p| p.shots_on_target).sum(),
        goals: team_players.iter().map(|p| p.goals).sum(),
        sca: team_players.iter().map(|p| p.sca).sum(),
        gca: team_players.iter().map(|p| p.gca).sum(),
        passes_completed: team_players.iter().map(|p| p.passes_completed).sum(),
        passes_progressive: team_players.iter().map(|p| p.progressive_passes).sum(),
        passes_final_third: team_players.iter().map(|p| p.passes_final_third).sum(),
        key_passes: team_players.iter().map(|p| p.key_passes).sum(),
        tackles_won: team_players.iter().map(|p| p.tackles_won).sum(),
        interceptions: team_players.iter().map(|p| p.interceptions).sum(),
        blocks: team_players.iter().map(|p| p.blocks).sum(),
        clearances: team_players.iter().map(|p| p.clearances).sum(),
        aerials_won: team_players.iter().map(|p| p.aerials_won).sum(),
        aerials_lost: team_players.iter().map(|p| p.aerials_lost).sum(),
        saves: 0,
        psxg: 0.0,
        fouls: team_players.iter().map(|p| p.fouls_committed).sum(),
        yellow_cards: team_players.iter().map(|p| p.yellow_cards).sum(),
        red_cards: team_players.iter().map(|p| p.red_cards).sum(),
        corners: team_players.iter().map(|p| p.corners).sum(),
        
        players: team_players.into_iter().map(|p| PlayerStats {
            name: p.name.clone(),
            position: p.position.clone(),
            minutes: p.minutes,
            goals: p.goals, // Added
            assists: p.assists, // Added
            shots: p.shots,
            shots_on_target: p.shots_on_target,
            xg: p.xg,
            xa: p.xa,
            sca: p.sca,
            touches_att_pen: 0, 
            progressive_carries: 0, 
            tackles: p.tackles_won, 
            interceptions: p.interceptions,
            fouls_committed: p.fouls_committed,
            fouls_drawn: p.fouls_drawn,
        }).collect(),
    }
}
