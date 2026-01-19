use anyhow::{Context, Result};
use scraper::{Html, Selector};
use serde::Serialize;
use std::{thread, time::Duration};

#[derive(Debug, Serialize)]
pub struct MatchBasicInfo {
    pub date: String,
    pub home_team: String,
    pub away_team: String,
    pub url: String,
    pub venue: String,
    pub time: String,
    pub home_url: String,
    pub away_url: String,
}

pub async fn scrape_fixtures(league_url: &str) -> Result<Vec<MatchBasicInfo>> {
    println!(">>> [Scraper] Using FlareSolverr for URL: {}", league_url);

    // 1. Get HTML via FlareSolverr
    let body_html = crate::flare_solverr::get_html(league_url).await
        .context("Failed to retrieve HTML from FlareSolverr")?;
        
    println!(">>> [Scraper] HTML Content retrieved ({} bytes). Parsing...", body_html.len());

    let document = Html::parse_document(&body_html);

    // Selectors
    let row_selector = Selector::parse("table.stats_table tbody tr").unwrap();
    let date_selector = Selector::parse("td[data-stat='date'] a").unwrap();
    let home_selector = Selector::parse("td[data-stat='home_team'] a").unwrap();
    let away_selector = Selector::parse("td[data-stat='away_team'] a").unwrap();
    let score_selector = Selector::parse("td[data-stat='score']").unwrap(); 
    let match_url_selector = Selector::parse("td[data-stat='score'] a").unwrap();
    let report_selector = Selector::parse("td[data-stat='match_report'] a").unwrap();
    
    // Venue Selector
    let venue_selector = Selector::parse("td[data-stat='venue']").unwrap();
    let time_selector = Selector::parse("td[data-stat='start_time']").unwrap();

    let mut fixtures = Vec::new();
    let rows = document.select(&row_selector);
    let mut row_count = 0;
    
    // Date Limit Logic
    let limit_date = chrono::Local::now().date_naive() + chrono::Duration::days(30);
    println!(">>> [Scraper] Filtering fixtures beyond: {}", limit_date);

    for row in rows {
        row_count += 1;
        // Skip spacer rows / headers
        if row.value().attr("class").map_or(false, |c| c.contains("thead")) {
            continue;
        }

        let date_str = match row.select(&date_selector).next() {
            Some(el) => el.text().collect::<String>(),
            None => continue, 
        };
        
        // Extract Time
        let time_str = row.select(&time_selector).next()
            .map(|el| el.text().collect::<String>().trim().to_string())
            .unwrap_or_default();

        // Date Check
        if let Ok(parsed_date) = chrono::NaiveDate::parse_from_str(&date_str, "%Y-%m-%d") {
            if parsed_date > limit_date {
                println!(">>> [Scraper] Date {} exceeds limit ({}). Stopping or skipping.", date_str, limit_date);
                break; 
            }
        }

        // Extract Home URL
        let home_url = row.select(&home_selector).next()
            .and_then(|el| el.value().attr("href"))
            .map(|s| if s.starts_with("http") { s.to_string() } else { format!("https://fbref.com{}", s) })
            .unwrap_or_default();

        let home = match row.select(&home_selector).next() {
            Some(el) => el.text().collect::<String>(),
            None => continue, 
        };

        // Extract Away URL
        let away_url = row.select(&away_selector).next()
            .and_then(|el| el.value().attr("href"))
            .map(|s| if s.starts_with("http") { s.to_string() } else { format!("https://fbref.com{}", s) })
            .unwrap_or_default();

        let away = match row.select(&away_selector).next() {
            Some(el) => el.text().collect::<String>(),
            None => continue,
        };
        
        let score_txt = row.select(&score_selector).next().map(|el| el.text().collect::<String>()).unwrap_or_default();
        let is_finished = score_txt.chars().any(|c| c.is_numeric()) && score_txt.contains("–"); 

        if is_finished {
            continue; 
        }

        // Extract Venue
        let venue = match row.select(&venue_selector).next() {
            Some(el) => {
                let text = el.text().collect::<String>().trim().to_string();
                if text.is_empty() { "Unknown Venue".to_string() } else { text }
            },
            None => "Unknown Venue".to_string(),
        };

        // Extract URL
        let mut url = row.select(&match_url_selector).next()
            .and_then(|el| el.value().attr("href"))
            .map(|s| s.to_string());

        if url.is_none() {
              url = row.select(&report_selector).next()
                .and_then(|el| el.value().attr("href"))
                .map(|s| s.to_string());
        }

        let final_url = if let Some(u) = url {
            if u.starts_with("http") { u } else { format!("https://fbref.com{}", u) }
        } else {
            format!("fixture://{}/{}/{}", date_str, home, away) 
        };

        println!(">>> [Scraper] Found Fixture: {} {} vs {} @ {}", date_str, home, away, venue);
        
        // Push with new fields
        fixtures.push(MatchBasicInfo {
            date: date_str,
            home_team: home,
            away_team: away,
            url: final_url,
            venue,
            time: time_str,
            home_url,
            away_url,
        });
    }

    println!(">>> [Scraper] Parsing complete. Processed {} rows. Found {} Upcoming Matches.", row_count, fixtures.len());
    
    Ok(fixtures)
}
