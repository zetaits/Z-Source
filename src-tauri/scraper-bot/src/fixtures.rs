use anyhow::Result;
use scraper::{Html, Selector};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct MatchBasicInfo {
    pub date: String,
    pub home_team: String,
    pub away_team: String,
    pub url: String,
}

pub async fn scrape_fixtures(league_url: &str) -> Result<Vec<MatchBasicInfo>> {
    let resp = reqwest::get(league_url).await?.text().await?;
    let document = Html::parse_document(&resp);

    // FBref typical fixtures table selector
    // It's usually a large table with id starting with "sched" or class "stats_table"
    let row_selector = Selector::parse("table.stats_table tbody tr").unwrap();
    let date_selector = Selector::parse("td[data-stat='date'] a").unwrap();
    let home_selector = Selector::parse("td[data-stat='home_team'] a").unwrap();
    let away_selector = Selector::parse("td[data-stat='away_team'] a").unwrap();
    let score_selector = Selector::parse("td[data-stat='score']").unwrap(); // To check if result exists
    let match_url_selector = Selector::parse("td[data-stat='score'] a").unwrap(); // Can be "Head-to-Head" or Score
    // note: if future match, 'score' column often has time or is empty, but URL is in a 'Head-to-Head' text or similar?
    // Actually on FBref fixtures:
    // Past match: Score is link.
    // Future match: Score is empty or Time. 'Match Report' link might not exist.
    // But there is usually a "Head-to-Head" link in the score column or notes? 
    // Wait, if no match report, we need a URL to identify it.
    // FBref often links the "Score" column to the match report even if future (preview)? Or maybe not.
    // Let's check typical structure.
    // Future matches often have NO link in the 'score' column. They just have text/time.
    // BUT we need a unique URL for our DB Key.
    // If there is no URL, we can't key it by URL effectively unless we construct one or use another key.
    // However, usually there is a "Head-to-Head" or some link.
    // Let's grab the 'Head-to-Head' link if 'Score' link is missing?
    // Actually, let's look for `td[data-stat='match_report'] a` or similar if it exists.
    // If absolutely no URL for the match, we might skip it or generate a synthetic ID (date+teams). 
    // The user instruction says: "URL del partido (para poder scrapear los detalles más tarde)".
    // If FBref doesn't give a URL for future matches, we can't "scrape details later" FROM THAT URL.
    // Most future matches on FBref DO have a link to a "Match Preview" or "Head-to-Head" page. 
    // Let's try to find any link in the row that looks like `/matches/`.
    
    let mut fixtures = Vec::new();

    for row in document.select(&row_selector) {
        // Skip spacer rows / headers
        if row.value().attr("class").map_or(false, |c| c.contains("thead")) {
            continue;
        }

        let date = match row.select(&date_selector).next() {
            Some(el) => el.text().collect::<String>(),
            None => continue, // No date, skip
        };

        let home = match row.select(&home_selector).next() {
            Some(el) => el.text().collect::<String>(),
            None => continue, 
        };

        let away = match row.select(&away_selector).next() {
            Some(el) => el.text().collect::<String>(),
            None => continue,
        };
        
        // Check if finished (has score)
        let score_txt = row.select(&score_selector).next().map(|el| el.text().collect::<String>()).unwrap_or_default();
        // If score_txt looks like "3–1", it's finished. If "20:00" or empty, it's future.
        // Heuristic: If it contains en-dash or similar separator and is short, it's a score.
        // Or if the link text is a score.
        
        let is_finished = score_txt.chars().any(|c| c.is_numeric()) && score_txt.contains("–"); // FBref uses en-dash

        if is_finished {
            continue; 
        }

        // Extract URL
        // Try score link first (sometimes previews)
        let mut url = row.select(&match_url_selector).next()
            .and_then(|el| el.value().attr("href"))
            .map(|s| s.to_string());

        // Use a generic logic: Find any link in the row pointing to /matches/
        if url.is_none() {
             // Logic to find ANY match link... tricky without being too broad.
             // Usually future matches don't have a unique match page until close? 
             // IF no URL, let's construct a synthetic one: "fixture:{date}:{home}:{away}"
             // BUT user wants to scrape details later.
             // If FBref doesn't have a page yet, we can't scrape details. 
             // We'll store it with synthetic URL so we can at least show it in "Programado".
             // When it becomes active, FBref presumably adds a link.
             // We'll update logic: If we find a real link later, we might need to handle ID collision or update the URL?
             // "upsert with url as key" -> if we use synthetic, we can't update it to real URL easily without logic.
             // Let's assume for now valid matches have a link, usually "Head-to-Head" or "Match Report".
             // We will try one more selector: `td[data-stat='score']` generic text might be the only info.
             // Let's try finding the "Match Report" column if it exists.
             // Actually, FBref keeps `match_report` column distinct.
             // `td[data-stat='match_report'] a`
             let report_selector = Selector::parse("td[data-stat='match_report'] a").unwrap();
              url = row.select(&report_selector).next()
                .and_then(|el| el.value().attr("href"))
                .map(|s| s.to_string());
        }

        let final_url = if let Some(u) = url {
            if u.starts_with("http") { u } else { format!("https://fbref.com{}", u) }
        } else {
            // Synthetic URL for database constraint (and to allow showing in UI)
            format!("fixture://{}/{}/{}", date, home, away) 
        };

        fixtures.push(MatchBasicInfo {
            date,
            home_team: home,
            away_team: away,
            url: final_url,
        });
    }

    Ok(fixtures)
}
