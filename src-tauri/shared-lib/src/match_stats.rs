use anyhow::{Context, Result};
use regex::Regex;
use scraper::{Html, Selector};
use crate::db::{FootballMatchStats, MatchContext, PlayerStats, TeamStats}; 
use std::collections::HashMap;

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

// New Function: Get Team URLs from Match Page (for Pre-Match Analysis)
pub async fn get_team_urls_from_match_page(url: &str) -> Result<(String, String)> {
    println!(">>> [MatchStats] Extracting team URLs from: {}", url);
    
    let body_html = crate::flare_solverr::get_html(url).await
        .context("Failed to get match page via FlareSolverr")?;

    let document = Html::parse_document(&body_html);
    
    // Selector for team links in scorebox (usually big headers)
    // FBref structure: div.scorebox -> div -> div -> strong -> a
    let team_selector = Selector::parse("div.scorebox div[itemprop='performer'] a, div.scorebox strong a").unwrap();
    
    let mut urls = Vec::new();
    for link in document.select(&team_selector) {
        if let Some(href) = link.value().attr("href") {
            if href.contains("/squads/") {
                let full_url = if href.starts_with("http") { href.to_string() } else { format!("https://fbref.com{}", href) };
                if !urls.contains(&full_url) {
                    urls.push(full_url);
                }
            }
        }
    }

    if urls.len() >= 2 {
        Ok((urls[0].clone(), urls[1].clone()))
    } else {
        anyhow::bail!("Could not find 2 team URLs in scorebox. Found: {:?}", urls);
    }
}

pub async fn scrape_match(url: &str) -> Result<FootballMatchStats> {
    println!("Scraping match details via FlareSolverr: {}", url);
    
    // 1. Get HTML
    let raw_html = crate::flare_solverr::get_html(url).await
        .context("Failed to get match HTML via FlareSolverr")?;

    // 2. Clean HTML (FBref hides tables in comments sometimes, though FlareSolverr might return rendered js, 
    // it's safer to un-comment just in case static HTML is returned)
    // Actually FlareSolverr returns the DOM after JS execution usually, but FBref is tricky.
    // Let's keep the regex cleaning as a safety net.
    let re = Regex::new(r"<!--|-->").unwrap();
    let clean_html = re.replace_all(&raw_html, "").to_string();
    let document = Html::parse_document(&clean_html);

    // Check availability
    if document.select(&Selector::parse(".scorebox").unwrap()).next().is_none() {
         return Err(anyhow::anyhow!("Match data (.scorebox) not found in FlareSolverr response."));
    }



    let re = Regex::new(r"<!--|-->").unwrap();
    let clean_html = re.replace_all(&raw_html, "").to_string();
    let document = Html::parse_document(&clean_html);

    // Extraction Logic (Venue, etc)
    let meta_rows_sel = Selector::parse("div.scorebox_meta > div").unwrap();
    let mut venue = String::new();
    let mut referee = String::new();
    let mut attendance = None;

    for row in document.select(&meta_rows_sel) {
        let text = row.text().collect::<Vec<_>>().join(" ");
        if text.contains("Venue") {
            venue = text.replace("Venue", "").replace(":", "").trim().to_string();
        } else if text.contains("Attendance") {
            let num_str = text.replace("Attendance", "").replace(":", "").replace(",", "").trim().to_string();
            attendance = num_str.parse::<u32>().ok();
        } else if text.contains("Referee") || text.contains("Official") {
             referee = text.replace("Referee", "").replace("Officials", "").replace(":", "").replace("(Referee)", "").trim().to_string();
        }
    }

    // Teams
    let team_selector = Selector::parse("div.scorebox div[itemprop='performer'] a").unwrap();
    let mut team_names = Vec::new();
    for el in document.select(&team_selector) {
        team_names.push(el.inner_html().trim().to_string());
    }

    let home_team_name = team_names.get(0).cloned().unwrap_or("Home".to_string());
    let away_team_name = team_names.get(1).cloned().unwrap_or("Away".to_string());

    let context = MatchContext {
        referee,
        venue,
        attendance,
    };

    // Parse Tables
    let mut home_player_map: PlayerMap = HashMap::new();
    let mut away_player_map: PlayerMap = HashMap::new();

    let categories = vec![
        ("summary", process_summary_row as fn(&scraper::ElementRef, &mut PartialPlayerStats)),
        ("passing", process_passing_row),
        ("passing_types", process_pass_types_row),
        ("defense", process_defense_row),
        ("misc", process_misc_row),
        ("gca", process_gca_row),
    ];

    for (keyword, processor) in categories {
        let tables: Vec<_> = document.select(&Selector::parse("table").unwrap())
            .filter(|t| {
                let id = t.value().id().unwrap_or("");
                if !id.contains(keyword) { return false; }
                if keyword == "passing" && id.contains("passing_types") { return false; }
                true
            })
            .collect();

        if tables.len() >= 2 {
            process_single_table(&tables[0], &mut home_player_map, processor);
            process_single_table(&tables[1], &mut away_player_map, processor);
        }
    }

    let home_stats = build_team_stats_from_map(&home_player_map, &home_team_name);
    let away_stats = build_team_stats_from_map(&away_player_map, &away_team_name);

    Ok(FootballMatchStats {
        context,
        home_stats,
        away_stats,
    })
}

// --- Helpers ---

fn process_single_table<F>(table: &scraper::ElementRef, map: &mut PlayerMap, row_handler: F) 
where F: Fn(&scraper::ElementRef, &mut PartialPlayerStats) 
{
    let row_sel = Selector::parse("tbody tr").unwrap();
    let player_sel = Selector::parse("th[data-stat='player'] a").unwrap();
    for row in table.select(&row_sel) {
        if row.value().attr("class").map_or(false, |c| c.contains("thead")) { continue; }
        if let Some(player_link) = row.select(&player_sel).next() {
            let player_name = player_link.inner_html().trim().to_string();
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
fn process_gca_row(_row: &scraper::ElementRef, _stats: &mut PartialPlayerStats) {}

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
        name: team_name.to_string(),
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
            goals: p.goals, 
            assists: p.assists, 
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
