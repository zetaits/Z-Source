mod league_crawler;

use anyhow::Result;
use shared_lib::db::{init_db, save_match_complete};
use rusqlite::Connection;
use std::{thread, time::Duration};

#[tokio::main]
async fn main() -> Result<()> {
    // 0. Setup DB (Rusqlite)
    let mut conn = Connection::open("sports_data.db")?;
    
    // Initialize Schema
    init_db(&conn)?;

    // 1. Crawl League
    let league_url = "https://fbref.com/en/comps/9/Premier-League-Stats"; // Configurable
    println!("Step 1: Crawling League: {}", league_url);
    
    // league_crawler is still local for now
    let teams = league_crawler::get_teams(league_url).await?;
    println!("Found {} teams.", teams.len());
    
    // For demo, we'll pick the FIRST team only to avoid infinite run
    if let Some(team) = teams.first() {
        println!("\nStep 2: Processing Team: {}", team.name);
        
        let match_urls = shared_lib::team_schedule::get_team_match_history(&team.base_url).await?;
        println!("Found {} total matches for {}.", match_urls.len(), team.name);

        println!("\nStep 3: Processing Matches (Deduplication Active)...");
        
        for (i, url) in match_urls.iter().enumerate() {
            // DEDUPLICATION CHECK (Relational)
            let exists: bool = conn.query_row(
                "SELECT EXISTS(SELECT 1 FROM events WHERE url = ?1)",
                [url],
                |row| row.get(0),
            )?;

            if exists {
                println!("[{}/{}] \u{23ed}\u{fe0f} Skipping (Already in DB): {}", i+1, match_urls.len(), url);
                continue;
            }

            println!("[{}/{}] \u{1f504} Scraping: {}", i+1, match_urls.len(), url);
            
            match shared_lib::match_stats::scrape_match(url).await {
                Ok(stats) => {
                    // Save Relational Data
                    // Date text is currently fixed or extracted? 
                    // scraper should return it in context ideally. 
                    // match_stats.rs has `context.venue` etc, but date?
                    // We'll pass a placeholder or today's date string for now as requested.
                    let date_str = "2024-01-01"; 
                    
                    save_match_complete(&mut conn, &stats, date_str, url)?;
                    println!("\u{2705} Saved: {}", url);
                },
                Err(e) => {
                    eprintln!("\u{274c} Error scraping {}: {:?}", url, e);
                }
            }
            
            // Limit to 2 matches for this demo run 
            if i >= 1 {
                println!("(Demo Limit Reached: Stopping after 2 matches)");
                break;
            }
        }
    }

    Ok(())
}
