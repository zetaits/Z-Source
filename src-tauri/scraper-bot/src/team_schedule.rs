use anyhow::{Context, Result};
use headless_chrome::{Browser, LaunchOptions};
use scraper::{Html, Selector};
use std::{collections::HashSet, thread, time::Duration};
use rand::Rng;

const SEASONS: [&str; 3] = ["2024-2025", "2023-2024", "2022-2023"];

pub async fn get_team_match_history(team_base_url: &str) -> Result<Vec<String>> {
    println!("Getting match history for: {}", team_base_url);
    
    // 1. Launch Browser (Headless Chrome)
    let launch_options = LaunchOptions {
        window_size: Some((1920, 1080)),
        ..Default::default()
    };
    let browser = Browser::new(launch_options).context("Failed to launch browser")?;
    let tab = browser.new_tab().context("Failed to create tab")?;

    // Configure UA
    tab.set_user_agent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        None, 
        None
    )?;

    let mut all_match_urls = HashSet::new();

    for season in SEASONS {
        // 2. Construct URL
        // Pattern: {base_url}{season}/matchlogs/all_comps/schedule/
        // base_url finishes with /, e.g. https://fbref.com/en/squads/18bb7c10/
        let season_url = format!("{}{}/matchlogs/all_comps/schedule/", team_base_url, season);
        println!("Crawling season: {} -> {}", season, season_url);

        // Random sleep + Rate Limit Handling
        let sleep_secs = rand::thread_rng().gen_range(2..=4);
        thread::sleep(Duration::from_secs(sleep_secs));

        if let Err(e) = tab.navigate_to(&season_url) {
            eprintln!("Failed to navigate to {}: {}", season_url, e);
            continue;
        }
        
        if let Err(e) = tab.wait_until_navigated() {
             eprintln!("Timeout waiting for {}: {}", season_url, e);
             // continue? try to proceed
        }

        // Wait for render
        thread::sleep(Duration::from_secs(2));

        // 3. Extract Headers/Matches
        // We get full HTML content to parse with scraper
        let body_html = match tab.find_element("body") {
            Ok(el) => el.get_content().unwrap_or_default(),
            Err(_) => String::new(),
        };

        let document = Html::parse_document(&body_html);
        
        // Tabla de logs de partidos (normalmente id="matchlogs_for")
        let table_selector = Selector::parse("table[id^='matchlogs_for']").unwrap();
        let row_selector = Selector::parse("tbody tr").unwrap();
        let match_report_selector = Selector::parse("td[data-stat='match_report'] a").unwrap();

        if let Some(table) = document.select(&table_selector).next() {
            for row in table.select(&row_selector) {
                // Header rows inside tbody skip
                // Header rows inside tbody skip
                if row.value().attr("class").map_or(false, |c| c.contains("thead")) {
                    continue;
                }

                if let Some(link) = row.select(&match_report_selector).next() {
                    let text = link.inner_html().trim().to_string();
                    if text == "Match Report" {
                        if let Some(href) = link.value().attr("href") {
                            // Convert relative to absolute
                            let full_url = if href.starts_with("http") {
                                href.to_string()
                            } else {
                                format!("https://fbref.com{}", href)
                            };
                            all_match_urls.insert(full_url);
                        }
                    }
                }
            }
        } else {
             eprintln!("No matchlogs table found for season {}", season);
        }
    }

    Ok(all_match_urls.into_iter().collect())
}
