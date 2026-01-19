use anyhow::{Context, Result};
use scraper::{Html, Selector};
use std::collections::HashSet;

const SEASONS: [&str; 3] = ["2024-2025", "2023-2024", "2022-2023"];

pub async fn get_team_match_history(team_base_url: &str) -> Result<Vec<String>> {
    println!("Getting match history for: {}", team_base_url);
    
    let mut all_match_urls = HashSet::new();

    for season in SEASONS {
        // Handle URL (ensure trailing slash)
        let base = if team_base_url.ends_with('/') { team_base_url.to_string() } else { format!("{}/", team_base_url) };
        let season_url = format!("{}{}/matchlogs/all_comps/schedule/", base, season);
        println!("Crawling season: {} -> {}", season, season_url);

        // Call FlareSolverr
        let body_html = match crate::flare_solverr::get_html(&season_url).await {
            Ok(html) => html,
            Err(e) => {
                eprintln!("Failed to get valid HTML for season {}: {}", season, e);
                continue;
            }
        };

        if body_html.is_empty() {
             continue;
        }

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
