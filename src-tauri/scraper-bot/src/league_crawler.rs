use anyhow::{Context, Result};
use scraper::{Html, Selector};
use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
pub struct TeamSource {
    pub name: String,
    pub id: String,
    pub base_url: String, // https://fbref.com/en/squads/ID/
}

pub async fn get_teams(league_url: &str) -> Result<Vec<TeamSource>> {
    println!(">>> [LeagueCrawler] Getting Teams via FlareSolverr: {}", league_url);
    
    // 1. Get HTML via FlareSolverr (using shared_lib helper)
    let body_html = shared_lib::flare_solverr::get_html(league_url).await
        .context("Failed to get league page via FlareSolverr")?;
    
    // 2. Parse
    let document = Html::parse_document(&body_html);

    // Estrategia Robustez: Buscar cualquier tabla y validar si tiene headers correctos
    let table_selector = Selector::parse("table").unwrap();
    let header_selector = Selector::parse("th").unwrap();
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
        anyhow::bail!("No suitable table found via FlareSolverr.");
    }

    Ok(teams)
}
