use anyhow::{Context, Result};
use headless_chrome::{Browser, LaunchOptions};
use scraper::{Html, Selector};
use serde::Serialize;
use std::{thread, time::Duration};
use rand::Rng;

#[derive(Debug, Serialize, Clone)]
pub struct TeamSource {
    pub name: String,
    pub id: String,
    pub base_url: String, // https://fbref.com/en/squads/ID/
}

pub async fn get_teams(league_url: &str) -> Result<Vec<TeamSource>> {
    // 1. Launch Browser (Headless Chrome)
    let launch_options = LaunchOptions {
        window_size: Some((1920, 1080)),
        ..Default::default()
    };
    let browser = Browser::new(launch_options).context("Failed to launch browser")?;
    let tab = browser.new_tab().context("Failed to create tab")?;

    // 2. Configure UA & Navigate
    tab.set_user_agent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        None, 
        None
    )?;
    
    // Random sleep
    let sleep_secs = rand::thread_rng().gen_range(2..=5);
    thread::sleep(Duration::from_secs(sleep_secs));

    tab.navigate_to(league_url)?.wait_until_navigated()?;

    // 3. Extract HTML (Bypassing HTTP 403 from reqwest)
    // We wait a bit for potential JS render
    thread::sleep(Duration::from_secs(2));
    
    // We get the full HTML content
    // headless_chrome element.get_content() returns outerHTML.
    let body_html = tab.find_element("body")?.get_content()?;
    
    // 4. Parse with Scraper (Resusing logic)
    let document = Html::parse_document(&body_html);

    // Estrategia Robustez: Buscar cualquier tabla y validar si tiene headers correctos
    let table_selector = Selector::parse("table").unwrap();
    let header_selector = Selector::parse("th").unwrap();
    // let row_selector = Selector::parse("tr").unwrap(); // Unused
    let squad_selector = Selector::parse("[data-stat='squad'] a, [data-stat='team'] a").unwrap();

    let mut teams = Vec::new();
    let mut target_table = None;
    
    for table in document.select(&table_selector) {
        // Verificar headers
        let is_valid = table.select(&header_selector).any(|th| {
            let text = th.inner_html().to_lowercase();
            text.contains("squad") || text.contains("team") || text.contains("club")
        });

        if is_valid {
            target_table = Some(table);
            break;
        }
    }

    if let Some(table) = target_table {
        let body_row_selector = Selector::parse("tbody tr").unwrap();
        
        for row in table.select(&body_row_selector) {
            // Ignorar filas de separacion 
            // Ignorar filas de separacion 
            if row.value().attr("class").map_or(false, |c| c.contains("thead")) {
                continue;
            }

            if let Some(link) = row.select(&squad_selector).next() {
                let name = link.inner_html().trim().to_string();
                if let Some(href) = link.value().attr("href") {
                    let parts: Vec<&str> = href.split('/').collect();
                    if let Some(squads_idx) = parts.iter().position(|&p| p == "squads") {
                        if let Some(id) = parts.get(squads_idx + 1) {
                            let base_url = format!("https://fbref.com/en/squads/{}/", id);
                            
                            teams.push(TeamSource {
                                name,
                                id: id.to_string(),
                                base_url,
                            });
                        }
                    }
                }
            }
        }
    } else {
        anyhow::bail!("No suitable table found via Headless Chrome.");
    }

    Ok(teams)
}
