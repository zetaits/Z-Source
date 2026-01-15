use anyhow::{Context, Result};
use headless_chrome::{Browser, LaunchOptions};
use scraper::{Html, Selector};
use std::{collections::HashSet, thread, time::Duration};
use rand::Rng;

const SEASONS: [&str; 3] = ["2024-2025", "2023-2024", "2022-2023"];

pub async fn get_team_match_history(team_base_url: &str) -> Result<Vec<String>> {
    println!("Getting match history for: {}", team_base_url);
    
    // 1. Launch Browser
    let launch_options = LaunchOptions {
        window_size: Some((1920, 1080)),
        ..Default::default()
    };
    let browser = Browser::new(launch_options).context("Failed to launch browser")?;
    let tab = browser.new_tab().context("Failed to create tab")?;

    tab.set_user_agent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        None, 
        None
    )?;

    let mut all_match_urls = HashSet::new();

    for season in SEASONS {
        // Handle URL (ensure trailing slash)
        let base = if team_base_url.ends_with('/') { team_base_url.to_string() } else { format!("{}/", team_base_url) };
        let season_url = format!("{}{}/matchlogs/all_comps/schedule/", base, season);
        println!("Crawling season: {} -> {}", season, season_url);

        let sleep_secs = rand::thread_rng().gen_range(2..=4);
        thread::sleep(Duration::from_secs(sleep_secs));

        if let Err(e) = tab.navigate_to(&season_url) {
            eprintln!("Failed to navigate to {}: {}", season_url, e);
            continue;
        }
        
        if let Err(_) = tab.wait_until_navigated() {
             // continue
        }

        thread::sleep(Duration::from_secs(2));

        let body_html = match tab.find_element("body") {
            Ok(el) => el.get_content().unwrap_or_default(),
            Err(_) => String::new(),
        };

        let document = Html::parse_document(&body_html);
        
        let table_selector = Selector::parse("table[id^='matchlogs_for']").unwrap();
        let row_selector = Selector::parse("tbody tr").unwrap();
        let match_report_selector = Selector::parse("td[data-stat='match_report'] a").unwrap();

        if let Some(table) = document.select(&table_selector).next() {
            for row in table.select(&row_selector) {
                if row.value().attr("class").map_or(false, |c| c.contains("thead")) {
                    continue;
                }

                if let Some(link) = row.select(&match_report_selector).next() {
                    let text = link.inner_html().trim().to_string();
                    if text == "Match Report" {
                        if let Some(href) = link.value().attr("href") {
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
        }
    }

    Ok(all_match_urls.into_iter().collect())
}
